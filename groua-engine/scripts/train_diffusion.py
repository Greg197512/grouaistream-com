"""3️⃣ Train text-conditioned latent diffusion on frozen VQ-VAE latents."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
import torch
import torch.nn.functional as F
import yaml
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from groua.autoencoder import VQVAEAutoencoder
from groua.diffusion import DiffusionUNet
from groua.encoder import TextEncoder
from groua.utils import EMA, get_beta_schedule, get_logger

logger = get_logger("train_diff")


class LatentTextDataset(Dataset):
    def __init__(self, csv_path: str, autoencoder: VQVAEAutoencoder,
                 device: torch.device, segment_frames: int = 1024,
                 cfg_dropout: float = 0.1):
        self.df = pd.read_csv(csv_path)
        self.ae = autoencoder
        self.device = device
        self.segment_frames = segment_frames
        self.cfg_dropout = cfg_dropout

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        mel = torch.load(row["mel_path"])
        T = mel.size(-1)
        if T >= self.segment_frames:
            s = torch.randint(0, T - self.segment_frames + 1, (1,)).item()
            mel = mel[:, s:s + self.segment_frames]
        else:
            mel = F.pad(mel, (0, self.segment_frames - T))

        prompt = row["prompt"]
        # classifier-free guidance: drop prompt randomly
        if torch.rand(1).item() < self.cfg_dropout:
            prompt = ""
        return mel.unsqueeze(0), prompt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="configs/model.yaml")
    ap.add_argument("--training_config", default="configs/training.yaml")
    ap.add_argument("--processed_csv", required=True)
    ap.add_argument("--ae_ckpt", required=True, help="Pretrained VQ-VAE checkpoint")
    ap.add_argument("--out_dir", default="./ckpts")
    args = ap.parse_args()

    with open(args.config) as f:
        mcfg = yaml.safe_load(f)
    with open(args.training_config) as f:
        tcfg = yaml.safe_load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Device: {device}")

    # ---- frozen autoencoder ----
    ae_cfg = mcfg["autoencoder"]
    ae = VQVAEAutoencoder(
        in_channels=1,
        latent_channels=ae_cfg["latent_channels"],
        hidden_channels=ae_cfg["hidden_channels"],
        codebook_size=ae_cfg["codebook_size"],
        commitment_cost=ae_cfg["commitment_cost"],
    ).to(device)
    ae.load_state_dict(torch.load(args.ae_ckpt, map_location=device)["model"])
    ae.eval()
    for p in ae.parameters():
        p.requires_grad = False

    # ---- text encoder (frozen) ----
    txt_enc = TextEncoder(mcfg["text_encoder"]["model_name"],
                          max_length=mcfg["text_encoder"]["max_length"],
                          freeze=True).to(device)

    # ---- diffusion U-Net ----
    diff_cfg = mcfg["diffusion"]
    unet = DiffusionUNet(
        latent_channels=ae_cfg["latent_channels"],
        base_channels=diff_cfg["unet_base_channels"],
        channel_mults=diff_cfg["unet_channel_mults"],
        time_emb_dim=diff_cfg["time_embedding_dim"],
        context_dim=mcfg["text_encoder"]["embedding_dim"],
        num_heads=diff_cfg["num_heads"],
        num_timesteps=diff_cfg["num_timesteps"],
    ).to(device)

    train_cfg = tcfg["diffusion"]
    optimizer = torch.optim.AdamW(unet.parameters(),
                                  lr=train_cfg["learning_rate"],
                                  weight_decay=train_cfg["weight_decay"])
    ema = EMA(unet, decay=train_cfg["ema_decay"])

    betas = get_beta_schedule(diff_cfg["beta_schedule"], diff_cfg["num_timesteps"]).to(device)
    alphas_cumprod = torch.cumprod(1 - betas, dim=0)
    sqrt_a = torch.sqrt(alphas_cumprod)
    sqrt_om = torch.sqrt(1 - alphas_cumprod)

    ds = LatentTextDataset(args.processed_csv, ae, device,
                           cfg_dropout=train_cfg["cfg_dropout"])
    dl = DataLoader(ds, batch_size=train_cfg["batch_size"], shuffle=True,
                    num_workers=tcfg["dataloader"]["num_workers"], pin_memory=True,
                    collate_fn=lambda b: (torch.stack([x[0] for x in b]),
                                          [x[1] for x in b]))

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, train_cfg["epochs"] + 1):
        unet.train()
        pbar = tqdm(dl, desc=f"epoch {epoch}/{train_cfg['epochs']}")
        for mel, prompts in pbar:
            mel = mel.to(device)
            with torch.no_grad():
                latent = ae.encode(mel)
                ctx = txt_enc(prompts)

            B = latent.size(0)
            t = torch.randint(0, diff_cfg["num_timesteps"], (B,), device=device)
            noise = torch.randn_like(latent)
            noisy = sqrt_a[t].view(-1, 1, 1, 1) * latent + sqrt_om[t].view(-1, 1, 1, 1) * noise

            pred = unet(noisy, t, ctx)
            loss = F.mse_loss(pred, noise)

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(unet.parameters(), 1.0)
            optimizer.step()
            ema.update(unet)
            pbar.set_postfix(loss=f"{loss.item():.4f}")

        if epoch % train_cfg["ckpt_every"] == 0:
            ckpt = out_dir / f"diffusion_epoch{epoch}.pt"
            torch.save({"model": unet.state_dict(),
                        "ema": ema.shadow,
                        "epoch": epoch}, ckpt)
            logger.info(f"Saved checkpoint → {ckpt}")


if __name__ == "__main__":
    main()
