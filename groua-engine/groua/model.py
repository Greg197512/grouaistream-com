"""High-level GrouMusicModel: text → latent → mel → waveform."""
from __future__ import annotations

from typing import List, Optional

import torch
import torch.nn as nn

from .autoencoder import VQVAEAutoencoder
from .diffusion import DiffusionUNet
from .encoder import TextEncoder
from .utils import get_beta_schedule
from .vocoder import HiFiGANVocoder


class GrouMusicModel(nn.Module):
    """Full inference pipeline. Each component can be loaded/trained separately."""

    def __init__(
        self,
        text_encoder: TextEncoder,
        autoencoder: VQVAEAutoencoder,
        diffusion: DiffusionUNet,
        vocoder: HiFiGANVocoder,
        num_timesteps: int = 1000,
        beta_schedule: str = "cosine",
    ):
        super().__init__()
        self.text_encoder = text_encoder
        self.autoencoder = autoencoder
        self.diffusion = diffusion
        self.vocoder = vocoder

        betas = get_beta_schedule(beta_schedule, num_timesteps)
        alphas = 1.0 - betas
        alphas_cumprod = torch.cumprod(alphas, dim=0)
        self.register_buffer("betas", betas)
        self.register_buffer("alphas_cumprod", alphas_cumprod)
        self.register_buffer("sqrt_alphas_cumprod", torch.sqrt(alphas_cumprod))
        self.register_buffer("sqrt_one_minus_alphas_cumprod", torch.sqrt(1 - alphas_cumprod))
        self.num_timesteps = num_timesteps

    # ---------------------------------------------------------------
    # Forward (training) — predict noise on randomly noised latent
    # ---------------------------------------------------------------
    def add_noise(self, latent: torch.Tensor, t: torch.Tensor, noise: torch.Tensor) -> torch.Tensor:
        sqrt_a = self.sqrt_alphas_cumprod[t].view(-1, 1, 1, 1)
        sqrt_om = self.sqrt_one_minus_alphas_cumprod[t].view(-1, 1, 1, 1)
        return sqrt_a * latent + sqrt_om * noise

    # ---------------------------------------------------------------
    # DDIM sampling (deterministic, fast)
    # ---------------------------------------------------------------
    @torch.no_grad()
    def sample_ddim(
        self,
        prompts: List[str],
        latent_shape: tuple,
        num_steps: int = 50,
        guidance_scale: float = 7.5,
        seed: Optional[int] = None,
    ) -> torch.Tensor:
        device = next(self.parameters()).device
        if seed is not None:
            torch.manual_seed(seed)

        B = len(prompts)
        context = self.text_encoder(prompts).to(device)
        # classifier-free guidance: concat empty prompt
        uncond = self.text_encoder([""] * B).to(device)

        latent = torch.randn(B, *latent_shape, device=device)
        timesteps = torch.linspace(self.num_timesteps - 1, 0, num_steps, device=device).long()

        for i, t in enumerate(timesteps):
            t_batch = t.expand(B)
            # CFG: predict twice
            eps_cond = self.diffusion(latent, t_batch, context)
            eps_uncond = self.diffusion(latent, t_batch, uncond)
            eps = eps_uncond + guidance_scale * (eps_cond - eps_uncond)

            alpha_t = self.alphas_cumprod[t]
            alpha_prev = self.alphas_cumprod[timesteps[i + 1]] if i + 1 < len(timesteps) else torch.tensor(1.0, device=device)

            x0_pred = (latent - torch.sqrt(1 - alpha_t) * eps) / torch.sqrt(alpha_t)
            dir_xt = torch.sqrt(1 - alpha_prev) * eps
            latent = torch.sqrt(alpha_prev) * x0_pred + dir_xt

        return latent

    # ---------------------------------------------------------------
    # Full text → waveform pipeline
    # ---------------------------------------------------------------
    @torch.no_grad()
    def generate(
        self,
        prompts: List[str],
        duration_sec: float = 30.0,
        sample_rate: int = 48000,
        hop_length: int = 256,
        downsample: int = 4,
        num_steps: int = 50,
        guidance_scale: float = 7.5,
        seed: Optional[int] = None,
    ) -> torch.Tensor:
        # 1. compute latent shape from desired duration
        mel_frames = int(duration_sec * sample_rate / hop_length)
        # latent is downsampled by `downsample` along time, n_mels=80 → height=80//downsample
        H = 80 // downsample
        W = mel_frames // downsample
        latent_shape = (self.diffusion.in_conv.in_channels, H, W)

        # 2. sample via DDIM
        latent = self.sample_ddim(prompts, latent_shape, num_steps, guidance_scale, seed)

        # 3. decode latent → mel
        mel = self.autoencoder.decode(latent)
        # squeeze single-channel: (B, 1, n_mels, T) → (B, n_mels, T)
        if mel.dim() == 4 and mel.size(1) == 1:
            mel = mel.squeeze(1)

        # 4. mel → waveform
        wav = self.vocoder(mel)  # (B, 1, samples)
        return wav.squeeze(1)
