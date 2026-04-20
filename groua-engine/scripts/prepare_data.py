"""1️⃣ Prepare dataset: convert audio → log-mel + tokenize prompts."""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
import torch
import torchaudio
from tqdm import tqdm

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from groua.utils import waveform_to_mel, get_logger

logger = get_logger("prepare_data")


def process_one(audio_path: Path, sample_rate: int, n_mels: int, hop_length: int) -> torch.Tensor:
    wav, sr = torchaudio.load(str(audio_path))
    if wav.size(0) > 1:
        wav = wav.mean(0, keepdim=True)
    if sr != sample_rate:
        wav = torchaudio.functional.resample(wav, sr, sample_rate)
    mel = waveform_to_mel(wav.squeeze(0),
                          sample_rate=sample_rate,
                          n_mels=n_mels,
                          hop_length=hop_length)
    return mel


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--meta_csv", required=True, help="CSV with columns: audio_path,prompt[,genre,bpm]")
    ap.add_argument("--out_dir", required=True)
    ap.add_argument("--sample_rate", type=int, default=48000)
    ap.add_argument("--n_mels", type=int, default=80)
    ap.add_argument("--hop_length", type=int, default=256)
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    mel_dir = out_dir / "mels"
    mel_dir.mkdir(exist_ok=True)

    df = pd.read_csv(args.meta_csv)
    logger.info(f"Processing {len(df)} samples")

    out_rows = []
    for i, row in tqdm(df.iterrows(), total=len(df)):
        try:
            mel = process_one(Path(row["audio_path"]), args.sample_rate, args.n_mels, args.hop_length)
            mel_path = mel_dir / f"{i:08d}.pt"
            torch.save(mel, mel_path)
            out_rows.append({
                "mel_path": str(mel_path),
                "prompt": row["prompt"],
                "genre": row.get("genre", ""),
                "bpm": row.get("bpm", 0),
                "n_frames": mel.size(-1),
            })
        except Exception as e:
            logger.warning(f"Skip {row['audio_path']}: {e}")

    out_csv = out_dir / "processed.csv"
    pd.DataFrame(out_rows).to_csv(out_csv, index=False)
    logger.info(f"Wrote {len(out_rows)} entries → {out_csv}")


if __name__ == "__main__":
    main()
