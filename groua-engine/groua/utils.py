"""Utilities: mel ↔ waveform, schedulers, logging."""
from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Optional

import torch
import torch.nn.functional as F
import torchaudio
import torchaudio.transforms as T


# ---------------------------------------------------------------------------
# Mel-spectrogram helpers
# ---------------------------------------------------------------------------

def waveform_to_mel(
    wav: torch.Tensor,
    sample_rate: int = 48000,
    n_fft: int = 1024,
    hop_length: int = 256,
    n_mels: int = 80,
    f_min: float = 0.0,
    f_max: float = 24000.0,
) -> torch.Tensor:
    """Convert raw waveform (1D or 2D) to log-mel spectrogram (n_mels, T)."""
    if wav.dim() == 1:
        wav = wav.unsqueeze(0)
    mel_transform = T.MelSpectrogram(
        sample_rate=sample_rate,
        n_fft=n_fft,
        hop_length=hop_length,
        win_length=n_fft,
        n_mels=n_mels,
        f_min=f_min,
        f_max=f_max,
        power=1.0,
    ).to(wav.device)
    mel = mel_transform(wav)
    log_mel = torch.log(torch.clamp(mel, min=1e-5))
    return log_mel.squeeze(0)


def mel_to_waveform_griffin_lim(
    mel: torch.Tensor,
    sample_rate: int = 48000,
    n_fft: int = 1024,
    hop_length: int = 256,
    n_iter: int = 32,
) -> torch.Tensor:
    """Reconstruct waveform from mel using Griffin-Lim (fallback when no vocoder)."""
    inv_mel = T.InverseMelScale(
        n_stft=n_fft // 2 + 1,
        n_mels=mel.size(-2),
        sample_rate=sample_rate,
    ).to(mel.device)
    griffin = T.GriffinLim(
        n_fft=n_fft,
        hop_length=hop_length,
        n_iter=n_iter,
    ).to(mel.device)
    spec = inv_mel(torch.exp(mel))
    return griffin(spec)


# ---------------------------------------------------------------------------
# Diffusion noise schedules
# ---------------------------------------------------------------------------

def linear_beta_schedule(timesteps: int, beta_start: float = 1e-4, beta_end: float = 0.02) -> torch.Tensor:
    return torch.linspace(beta_start, beta_end, timesteps)


def cosine_beta_schedule(timesteps: int, s: float = 0.008) -> torch.Tensor:
    """Improved DDPM cosine schedule (Nichol & Dhariwal, 2021)."""
    steps = timesteps + 1
    x = torch.linspace(0, timesteps, steps)
    alphas_cumprod = torch.cos(((x / timesteps) + s) / (1 + s) * math.pi * 0.5) ** 2
    alphas_cumprod = alphas_cumprod / alphas_cumprod[0]
    betas = 1 - (alphas_cumprod[1:] / alphas_cumprod[:-1])
    return torch.clip(betas, 1e-4, 0.999)


def get_beta_schedule(name: str, timesteps: int) -> torch.Tensor:
    if name == "linear":
        return linear_beta_schedule(timesteps)
    if name == "cosine":
        return cosine_beta_schedule(timesteps)
    raise ValueError(f"Unknown beta schedule: {name}")


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def get_logger(name: str = "groua", log_file: Optional[Path] = None) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    fmt = logging.Formatter("[%(asctime)s] %(levelname)s %(name)s — %(message)s",
                            datefmt="%Y-%m-%d %H:%M:%S")
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    logger.addHandler(sh)
    if log_file:
        fh = logging.FileHandler(log_file)
        fh.setFormatter(fmt)
        logger.addHandler(fh)
    return logger


# ---------------------------------------------------------------------------
# EMA (exponential moving average) for diffusion model weights
# ---------------------------------------------------------------------------

class EMA:
    def __init__(self, model: torch.nn.Module, decay: float = 0.9999):
        self.decay = decay
        self.shadow = {k: v.detach().clone() for k, v in model.state_dict().items()}

    @torch.no_grad()
    def update(self, model: torch.nn.Module) -> None:
        for k, v in model.state_dict().items():
            if v.dtype.is_floating_point:
                self.shadow[k].mul_(self.decay).add_(v.detach(), alpha=1.0 - self.decay)
            else:
                self.shadow[k] = v.detach().clone()

    def apply_to(self, model: torch.nn.Module) -> None:
        model.load_state_dict(self.shadow)
