"""CLI inference: text prompt → wav file."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import torch
import torchaudio
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from groua.autoencoder import VQVAEAutoencoder
from groua.diffusion import DiffusionUNet
from groua.encoder import TextEncoder
from groua.model import GrouMusicModel
from groua.utils import get_logger
from groua.vocoder import HiFiGANVocoder

logger = get_logger("generate")


def load_model(model_cfg: dict, infer_cfg: dict, device: torch.device) -> GrouMusicModel:
    ae_cfg = model_cfg["autoencoder"]
    diff_cfg = model_cfg["diffusion"]
    voc_cfg = model_cfg["vocoder"]
    text_cfg = model_cfg["text_encoder"]

    text_encoder = TextEncoder(text_cfg["model_name"], text_cfg["max_length"], text_cfg["freeze"]).to(device)
    autoencoder = VQVAEAutoencoder(
        in_channels=1,
        latent_channels=ae_cfg["latent_channels"],
        hidden_channels=ae_cfg["hidden_channels"],
        codebook_size=ae_cfg["codebook_size"],
        commitment_cost=ae_cfg["commitment_cost"],
    ).to(device)
    diffusion = DiffusionUNet(
        latent_channels=ae_cfg["latent_channels"],
        base_channels=diff_cfg["unet_base_channels"],
        channel_mults=diff_cfg["unet_channel_mults"],
        time_emb_dim=diff_cfg["time_embedding_dim"],
        context_dim=text_cfg["embedding_dim"],
        num_heads=diff_cfg["num_heads"],
        num_timesteps=diff_cfg["num_timesteps"],
    ).to(device)
    vocoder = HiFiGANVocoder(
        n_mels=model_cfg["audio"]["n_mels"],
        upsample_rates=tuple(voc_cfg["upsample_rates"]),
        upsample_kernel_sizes=tuple(voc_cfg["upsample_kernel_sizes"]),
        resblock_kernel_sizes=tuple(voc_cfg["resblock_kernel_sizes"]),
        resblock_dilations=tuple(tuple(d) for d in voc_cfg["resblock_dilation_sizes"]),
    ).to(device)

    # load checkpoints
    ck = infer_cfg["checkpoints"]
    if Path(ck["autoencoder"]).exists():
        autoencoder.load_state_dict(torch.load(ck["autoencoder"], map_location=device)["model"])
        logger.info(f"Loaded autoencoder ← {ck['autoencoder']}")
    if Path(ck["diffusion"]).exists():
        ck_d = torch.load(ck["diffusion"], map_location=device)
        diffusion.load_state_dict(ck_d.get("ema", ck_d["model"]))
        logger.info(f"Loaded diffusion ← {ck['diffusion']}")
    if Path(ck["vocoder"]).exists():
        vocoder.load_state_dict(torch.load(ck["vocoder"], map_location=device)["model"])
        logger.info(f"Loaded vocoder ← {ck['vocoder']}")

    model = GrouMusicModel(
        text_encoder=text_encoder,
        autoencoder=autoencoder,
        diffusion=diffusion,
        vocoder=vocoder,
        num_timesteps=diff_cfg["num_timesteps"],
        beta_schedule=diff_cfg["beta_schedule"],
    ).to(device)
    model.eval()
    return model


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--duration", type=float, default=30.0)
    ap.add_argument("--steps", type=int, default=50)
    ap.add_argument("--guidance", type=float, default=7.5)
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--config", default="configs/model.yaml")
    ap.add_argument("--inference_config", default="configs/inference.yaml")
    ap.add_argument("--out", default="output.wav")
    args = ap.parse_args()

    with open(args.config) as f:
        mcfg = yaml.safe_load(f)
    with open(args.inference_config) as f:
        icfg = yaml.safe_load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = load_model(mcfg, icfg, device)

    logger.info(f"Generating: '{args.prompt}' ({args.duration}s, {args.steps} steps)")
    wav = model.generate(
        prompts=[args.prompt],
        duration_sec=args.duration,
        sample_rate=mcfg["audio"]["sample_rate"],
        hop_length=mcfg["audio"]["hop_length"],
        downsample=mcfg["autoencoder"]["downsample_factor"],
        num_steps=args.steps,
        guidance_scale=args.guidance,
        seed=args.seed,
    )

    torchaudio.save(args.out, wav.cpu(), sample_rate=mcfg["audio"]["sample_rate"])
    logger.info(f"Saved → {args.out}")


if __name__ == "__main__":
    main()
