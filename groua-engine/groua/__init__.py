"""GrouAI Music Engine — text-to-music latent diffusion pipeline."""

__version__ = "0.1.0"

from .model import GrouMusicModel
from .encoder import TextEncoder
from .autoencoder import VQVAEAutoencoder
from .diffusion import DiffusionUNet
from .vocoder import HiFiGANVocoder

__all__ = [
    "GrouMusicModel",
    "TextEncoder",
    "VQVAEAutoencoder",
    "DiffusionUNet",
    "HiFiGANVocoder",
]
