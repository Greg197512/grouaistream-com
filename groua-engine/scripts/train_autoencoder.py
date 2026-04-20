"""2️⃣ Train VQ-VAE autoencoder on log-mel spectrograms."""
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
from groua.utils import get_logger

logger = get_logger("train_ae")


class MelDataset(Dataset):
    def __init__(self, csv_path: str, segment_frames: int = 1024):
        self.df = pd.read_csv(csv_path)
        self.segment_frames = segment_frames

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        mel = torch.load(row["mel_path"])  # (n_mels, T)
        T = mel.size(-1)
        if T >= self.segment_frames:
            start = torch.randint(0, T - self.segment_frames + 1, (1,)).item()
            mel = mel[:, start:start + self.segment_frames]
        else:
            pad = self.segment_frames - T
            mel = F.pad(mel, (0, pad))
        return mel.unsqueeze(0)  # (1, n_mels, T)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="configs/model.yaml")
    ap.add_argument("--training_config", default="configs/training.yaml")
    ap.add_argument("--processed_csv", required=True)
    ap.add_argument("--out_dir", default="./ckpts")
    args = ap.parse_args()

    with open(args.config) as f:
        mcfg = yaml.safe_load(f)
    with open(args.training_config) as f:
        tcfg = yaml.safe_load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {device}")

    ae_cfg = mcfg["autoencoder"]
    train_cfg = tcfg["autoencoder"]

    model = VQVAEAutoencoder(
        in_channels=1,
        latent_channels=ae_cfg["latent_channels"],
        hidden_channels=ae_cfg["hidden_channels"],
        codebook_size=ae_cfg["codebook_size"],
        commitment_cost=ae_cfg["commitment_cost"],
    ).to(device)

    optimizer = torch.optim.AdamW(model.parameters(),
                                  lr=train_cfg["learning_rate"],
                                  weight_decay=train_cfg["weight_decay"])

    ds = MelDataset(args.processed_csv)
    dl = DataLoader(ds, batch_size=train_cfg["batch_size"], shuffle=True,
                    num_workers=tcfg["dataloader"]["num_workers"], pin_memory=True)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    step = 0
    for epoch in range(1, train_cfg["epochs"] + 1):
        model.train()
        pbar = tqdm(dl, desc=f"epoch {epoch}/{train_cfg['epochs']}")
        for mel in pbar:
            mel = mel.to(device)
            x_rec, vq_loss, _ = model(mel)
            recon_loss = F.l1_loss(x_rec, mel)
            loss = recon_loss + vq_loss

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            step += 1
            pbar.set_postfix(recon=f"{recon_loss.item():.4f}", vq=f"{vq_loss.item():.4f}")

        if epoch % train_cfg["ckpt_every"] == 0:
            ckpt = out_dir / f"autoencoder_epoch{epoch}.pt"
            torch.save({"model": model.state_dict(), "epoch": epoch}, ckpt)
            logger.info(f"Saved checkpoint → {ckpt}")


if __name__ == "__main__":
    main()
