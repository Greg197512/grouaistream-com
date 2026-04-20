"""VQ-VAE autoencoder: mel-spectrogram ↔ discrete latent."""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class ResidualBlock(nn.Module):
    def __init__(self, channels: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.GroupNorm(8, channels),
            nn.SiLU(),
            nn.Conv2d(channels, channels, 3, padding=1),
            nn.GroupNorm(8, channels),
            nn.SiLU(),
            nn.Conv2d(channels, channels, 3, padding=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.block(x)


class Encoder(nn.Module):
    def __init__(self, in_channels: int, hidden_channels=(64, 128, 256), latent_channels: int = 8):
        super().__init__()
        layers = [nn.Conv2d(in_channels, hidden_channels[0], 3, padding=1)]
        for i in range(len(hidden_channels) - 1):
            layers.append(ResidualBlock(hidden_channels[i]))
            layers.append(nn.Conv2d(hidden_channels[i], hidden_channels[i + 1],
                                    kernel_size=4, stride=2, padding=1))
        layers.append(ResidualBlock(hidden_channels[-1]))
        layers.append(nn.Conv2d(hidden_channels[-1], latent_channels, 1))
        self.net = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class Decoder(nn.Module):
    def __init__(self, out_channels: int, hidden_channels=(256, 128, 64), latent_channels: int = 8):
        super().__init__()
        layers = [nn.Conv2d(latent_channels, hidden_channels[0], 1),
                  ResidualBlock(hidden_channels[0])]
        for i in range(len(hidden_channels) - 1):
            layers.append(nn.ConvTranspose2d(hidden_channels[i], hidden_channels[i + 1],
                                             kernel_size=4, stride=2, padding=1))
            layers.append(ResidualBlock(hidden_channels[i + 1]))
        layers.append(nn.Conv2d(hidden_channels[-1], out_channels, 3, padding=1))
        self.net = nn.Sequential(*layers)

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        return self.net(z)


class VectorQuantizer(nn.Module):
    """VQ layer with EMA codebook updates."""

    def __init__(self, num_embeddings: int = 1024, embedding_dim: int = 8, commitment_cost: float = 0.25):
        super().__init__()
        self.K = num_embeddings
        self.D = embedding_dim
        self.beta = commitment_cost
        self.embedding = nn.Embedding(num_embeddings, embedding_dim)
        self.embedding.weight.data.uniform_(-1.0 / num_embeddings, 1.0 / num_embeddings)

    def forward(self, z: torch.Tensor):
        # z: (B, D, H, W) → (B*H*W, D)
        B, D, H, W = z.shape
        z_perm = z.permute(0, 2, 3, 1).contiguous()
        flat = z_perm.view(-1, D)

        dist = (flat.pow(2).sum(1, keepdim=True)
                - 2 * flat @ self.embedding.weight.t()
                + self.embedding.weight.pow(2).sum(1))
        ids = dist.argmin(dim=1)
        z_q = self.embedding(ids).view(B, H, W, D).permute(0, 3, 1, 2).contiguous()

        loss = F.mse_loss(z_q.detach(), z) + self.beta * F.mse_loss(z_q, z.detach())
        z_q = z + (z_q - z).detach()  # straight-through estimator
        return z_q, loss, ids.view(B, H, W)


class VQVAEAutoencoder(nn.Module):
    """Encode mel-spectrogram → discrete latent → decode back."""

    def __init__(
        self,
        in_channels: int = 1,           # mel as 1-ch image (n_mels treated as H)
        latent_channels: int = 8,
        hidden_channels=(64, 128, 256),
        codebook_size: int = 1024,
        commitment_cost: float = 0.25,
    ):
        super().__init__()
        self.encoder = Encoder(in_channels, hidden_channels, latent_channels)
        self.vq = VectorQuantizer(codebook_size, latent_channels, commitment_cost)
        self.decoder = Decoder(in_channels, tuple(reversed(hidden_channels)), latent_channels)

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        z = self.encoder(x)
        z_q, _, _ = self.vq(z)
        return z_q

    def decode(self, z: torch.Tensor) -> torch.Tensor:
        return self.decoder(z)

    def forward(self, x: torch.Tensor):
        z = self.encoder(x)
        z_q, vq_loss, ids = self.vq(z)
        x_rec = self.decoder(z_q)
        return x_rec, vq_loss, ids
