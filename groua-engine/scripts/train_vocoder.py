"""4️⃣ Fine-tune HiFi-GAN vocoder on (mel → waveform) pairs.

This is a simplified single-loss training (mel L1 + waveform L1).
For SOTA results add MultiPeriod & MultiScale Discriminators (GAN losses).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
import torch
import torch.nn.functional as F
import torchaudio
import yaml
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from groua.utils import get_logger, waveform_to_mel
from groua.vocoder import HiFiGANVocoder

logger = get_logger("train_voc")


class WavMelDataset(Dataset):
    def __init__(self, meta_csv: str, sample_rate: int = 48000,
                 n_mels: int = 80, hop_length: int = 256,
                 segment_seconds: float = 2.0):
        self.df = pd.read_csv(meta_csv)
        self.sr = sample_rate
        self.n_mels = n_mels
        self.hop = hop_length
        self.seg_samples = int(segment_seconds * sample_rate)

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        wav, sr = torchaudio.load(row["audio_path"])
        if wav.size(0) > 1:
            wav = wav.mean(0, keepdim=True)
        if sr != self.sr:
            wav = torchaudio.functional.resample(wav, sr, self.sr)
        wav = wav.squeeze(0)

        if wav.size(0) >= self.seg_samples:
            s = torch.randint(0, wav.size(0) - self.seg_samples + 1, (1,)).item()
            wav = wav[s:s + self.seg_samples]
        else:
            wav = F.pad(wav, (0, self.seg_samples - wav.size(0)))

        mel = waveform_to_mel(wav, sample_rate=self.sr, n_mels=self.n_mels, hop_length=self.hop)
        return mel, wav.unsqueeze(0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="configs/model.yaml")
    ap.add_argument("--training_config", default="configs/training.yaml")
    ap.add_argument("--meta_csv", required=True, help="CSV with audio_path column")
    ap.add_argument("--out_dir", default="./ckpts")
    args = ap.parse_args()

    with open(args.config) as f:
        mcfg = yaml.safe_load(f)
    with open(args.training_config) as f:
        tcfg = yaml.safe_load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    voc_cfg = mcfg["vocoder"]
    train_cfg = tcfg["vocoder"]

    model = HiFiGANVocoder(
        n_mels=mcfg["audio"]["n_mels"],
        upsample_rates=tuple(voc_cfg["upsample_rates"]),
        upsample_kernel_sizes=tuple(voc_cfg["upsample_kernel_sizes"]),
        resblock_kernel_sizes=tuple(voc_cfg["resblock_kernel_sizes"]),
        resblock_dilations=tuple(tuple(d) for d in voc_cfg["resblock_dilation_sizes"]),
    ).to(device)

    optimizer = torch.optim.AdamW(model.parameters(),
                                  lr=train_cfg["learning_rate"],
                                  betas=tuple(train_cfg["betas"]))

    ds = WavMelDataset(args.meta_csv,
                       sample_rate=mcfg["audio"]["sample_rate"],
                       n_mels=mcfg["audio"]["n_mels"],
                       hop_length=mcfg["audio"]["hop_length"])
    dl = DataLoader(ds, batch_size=train_cfg["batch_size"], shuffle=True,
                    num_workers=tcfg["dataloader"]["num_workers"], pin_memory=True)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, train_cfg["epochs"] + 1):
        model.train()
        pbar = tqdm(dl, desc=f"epoch {epoch}/{train_cfg['epochs']}")
        for mel, wav in pbar:
            mel = mel.to(device)
            wav = wav.to(device)
            wav_pred = model(mel)

            # crop to matching length
            min_len = min(wav.size(-1), wav_pred.size(-1))
            wav_loss = F.l1_loss(wav_pred[..., :min_len], wav[..., :min_len])

            mel_pred = waveform_to_mel(wav_pred.squeeze(1)[0],
                                       sample_rate=mcfg["audio"]["sample_rate"],
                                       n_mels=mcfg["audio"]["n_mels"],
                                       hop_length=mcfg["audio"]["hop_length"])
            mel_loss = F.l1_loss(mel_pred, mel[0])

            loss = train_cfg["lambda_mel"] * mel_loss + wav_loss

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            pbar.set_postfix(mel=f"{mel_loss.item():.4f}", wav=f"{wav_loss.item():.4f}")

        if epoch % train_cfg["ckpt_every"] == 0:
            ckpt = out_dir / f"vocoder_epoch{epoch}.pt"
            torch.save({"model": model.state_dict(), "epoch": epoch}, ckpt)
            logger.info(f"Saved checkpoint → {ckpt}")


if __name__ == "__main__":
    main()
