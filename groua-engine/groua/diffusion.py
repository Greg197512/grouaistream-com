"""Latent diffusion U-Net with cross-attention to text embeddings."""
from __future__ import annotations

import math
from typing import List

import torch
import torch.nn as nn
import torch.nn.functional as F
from einops import rearrange


# ---------------------------------------------------------------------------
# Time embedding (sinusoidal)
# ---------------------------------------------------------------------------

class SinusoidalTimeEmbedding(nn.Module):
    def __init__(self, dim: int):
        super().__init__()
        self.dim = dim

    def forward(self, t: torch.Tensor) -> torch.Tensor:
        half = self.dim // 2
        freqs = torch.exp(-math.log(10000) * torch.arange(half, device=t.device) / half)
        args = t.float()[:, None] * freqs[None]
        return torch.cat([args.sin(), args.cos()], dim=-1)


# ---------------------------------------------------------------------------
# Cross-attention block (Q from latent, K/V from text)
# ---------------------------------------------------------------------------

class CrossAttention(nn.Module):
    def __init__(self, query_dim: int, context_dim: int, heads: int = 8, dim_head: int = 64):
        super().__init__()
        inner_dim = heads * dim_head
        self.heads = heads
        self.scale = dim_head ** -0.5
        self.to_q = nn.Linear(query_dim, inner_dim, bias=False)
        self.to_k = nn.Linear(context_dim, inner_dim, bias=False)
        self.to_v = nn.Linear(context_dim, inner_dim, bias=False)
        self.to_out = nn.Linear(inner_dim, query_dim)

    def forward(self, x: torch.Tensor, context: torch.Tensor) -> torch.Tensor:
        # x: (B, N, C_q), context: (B, M, C_ctx)
        q = self.to_q(x)
        k = self.to_k(context)
        v = self.to_v(context)
        q, k, v = (rearrange(t, "b n (h d) -> b h n d", h=self.heads) for t in (q, k, v))
        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)
        out = attn @ v
        out = rearrange(out, "b h n d -> b n (h d)")
        return self.to_out(out)


# ---------------------------------------------------------------------------
# U-Net residual block (with time + optional cross-attention)
# ---------------------------------------------------------------------------

class ResnetBlock(nn.Module):
    def __init__(self, in_ch: int, out_ch: int, time_dim: int):
        super().__init__()
        self.norm1 = nn.GroupNorm(8, in_ch)
        self.conv1 = nn.Conv2d(in_ch, out_ch, 3, padding=1)
        self.time_proj = nn.Linear(time_dim, out_ch)
        self.norm2 = nn.GroupNorm(8, out_ch)
        self.conv2 = nn.Conv2d(out_ch, out_ch, 3, padding=1)
        self.skip = nn.Conv2d(in_ch, out_ch, 1) if in_ch != out_ch else nn.Identity()

    def forward(self, x: torch.Tensor, t_emb: torch.Tensor) -> torch.Tensor:
        h = self.conv1(F.silu(self.norm1(x)))
        h = h + self.time_proj(F.silu(t_emb))[:, :, None, None]
        h = self.conv2(F.silu(self.norm2(h)))
        return h + self.skip(x)


class TransformerBlock(nn.Module):
    """Self-attn + cross-attn (text) on flattened spatial tokens."""

    def __init__(self, channels: int, context_dim: int, heads: int = 8):
        super().__init__()
        self.norm1 = nn.LayerNorm(channels)
        self.self_attn = CrossAttention(channels, channels, heads=heads)
        self.norm2 = nn.LayerNorm(channels)
        self.cross_attn = CrossAttention(channels, context_dim, heads=heads)
        self.norm3 = nn.LayerNorm(channels)
        self.ff = nn.Sequential(nn.Linear(channels, 4 * channels), nn.GELU(),
                                nn.Linear(4 * channels, channels))

    def forward(self, x: torch.Tensor, context: torch.Tensor) -> torch.Tensor:
        B, C, H, W = x.shape
        x_flat = rearrange(x, "b c h w -> b (h w) c")
        x_flat = x_flat + self.self_attn(self.norm1(x_flat), self.norm1(x_flat))
        x_flat = x_flat + self.cross_attn(self.norm2(x_flat), context)
        x_flat = x_flat + self.ff(self.norm3(x_flat))
        return rearrange(x_flat, "b (h w) c -> b c h w", h=H, w=W)


# ---------------------------------------------------------------------------
# Full U-Net
# ---------------------------------------------------------------------------

class DiffusionUNet(nn.Module):
    def __init__(
        self,
        latent_channels: int = 8,
        base_channels: int = 128,
        channel_mults: List[int] = (1, 2, 4, 4),
        time_emb_dim: int = 256,
        context_dim: int = 768,        # T5-base hidden size
        num_heads: int = 8,
        num_timesteps: int = 1000,
    ):
        super().__init__()
        self.num_timesteps = num_timesteps

        # time embedding
        self.time_mlp = nn.Sequential(
            SinusoidalTimeEmbedding(base_channels),
            nn.Linear(base_channels, time_emb_dim),
            nn.SiLU(),
            nn.Linear(time_emb_dim, time_emb_dim),
        )

        # initial conv
        self.in_conv = nn.Conv2d(latent_channels, base_channels, 3, padding=1)

        # downsampling
        chs = [base_channels * m for m in channel_mults]
        self.downs = nn.ModuleList()
        prev = base_channels
        for ch in chs:
            self.downs.append(nn.ModuleList([
                ResnetBlock(prev, ch, time_emb_dim),
                TransformerBlock(ch, context_dim, num_heads),
                nn.Conv2d(ch, ch, 4, stride=2, padding=1),  # downsample
            ]))
            prev = ch

        # bottleneck
        self.mid_block1 = ResnetBlock(prev, prev, time_emb_dim)
        self.mid_attn = TransformerBlock(prev, context_dim, num_heads)
        self.mid_block2 = ResnetBlock(prev, prev, time_emb_dim)

        # upsampling
        self.ups = nn.ModuleList()
        for ch in reversed(chs):
            self.ups.append(nn.ModuleList([
                nn.ConvTranspose2d(prev, ch, 4, stride=2, padding=1),
                ResnetBlock(ch * 2, ch, time_emb_dim),       # *2 for skip cat
                TransformerBlock(ch, context_dim, num_heads),
            ]))
            prev = ch

        # output
        self.out_norm = nn.GroupNorm(8, prev)
        self.out_conv = nn.Conv2d(prev, latent_channels, 3, padding=1)

    def forward(self, x: torch.Tensor, t: torch.Tensor, context: torch.Tensor) -> torch.Tensor:
        """
        x:       (B, C, H, W) noisy latent
        t:       (B,) integer timesteps
        context: (B, L, D) text embeddings
        """
        t_emb = self.time_mlp(t)
        h = self.in_conv(x)

        skips = []
        for resnet, trans, down in self.downs:
            h = resnet(h, t_emb)
            h = trans(h, context)
            skips.append(h)
            h = down(h)

        h = self.mid_block1(h, t_emb)
        h = self.mid_attn(h, context)
        h = self.mid_block2(h, t_emb)

        for up, resnet, trans in self.ups:
            h = up(h)
            skip = skips.pop()
            # match sizes (in case of odd dims)
            if h.shape[-2:] != skip.shape[-2:]:
                h = F.interpolate(h, size=skip.shape[-2:], mode="nearest")
            h = torch.cat([h, skip], dim=1)
            h = resnet(h, t_emb)
            h = trans(h, context)

        return self.out_conv(F.silu(self.out_norm(h)))
