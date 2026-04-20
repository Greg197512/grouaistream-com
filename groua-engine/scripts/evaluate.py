"""5️⃣ Evaluation: FAD (Fréchet Audio Distance) + pitch metrics."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import torch
import torchaudio
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from groua.utils import get_logger

logger = get_logger("evaluate")


def compute_fad(real_dir: str, fake_dir: str) -> float:
    """Compute Fréchet Audio Distance using `frechet-audio-distance` package."""
    try:
        from frechet_audio_distance import FrechetAudioDistance
    except ImportError:
        logger.error("Install `frechet-audio-distance` to compute FAD.")
        return float("nan")

    fad = FrechetAudioDistance(
        model_name="vggish",
        sample_rate=16000,
        use_pca=False,
        use_activation=False,
        verbose=False,
    )
    score = fad.score(real_dir, fake_dir)
    return float(score)


def pitch_contour_similarity(wav_a: torch.Tensor, wav_b: torch.Tensor, sr: int = 48000) -> float:
    """Cosine similarity between pitch contours extracted via YIN-like algorithm."""
    try:
        import librosa
        import numpy as np
        f0_a = librosa.yin(wav_a.cpu().numpy(), fmin=50, fmax=2000, sr=sr)
        f0_b = librosa.yin(wav_b.cpu().numpy(), fmin=50, fmax=2000, sr=sr)
        n = min(len(f0_a), len(f0_b))
        f0_a, f0_b = f0_a[:n], f0_b[:n]
        cos = float(np.dot(f0_a, f0_b) / (np.linalg.norm(f0_a) * np.linalg.norm(f0_b) + 1e-9))
        return cos
    except Exception as e:
        logger.warning(f"pitch sim failed: {e}")
        return float("nan")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--real_dir", required=True, help="Directory with reference .wav files")
    ap.add_argument("--fake_dir", required=True, help="Directory with generated .wav files")
    ap.add_argument("--out_json", default="metrics.json")
    args = ap.parse_args()

    metrics = {}
    logger.info("Computing Fréchet Audio Distance...")
    metrics["fad"] = compute_fad(args.real_dir, args.fake_dir)

    # average pairwise pitch similarity (sample 50 pairs)
    real_files = sorted(Path(args.real_dir).glob("*.wav"))[:50]
    fake_files = sorted(Path(args.fake_dir).glob("*.wav"))[:50]
    sims = []
    for r, f in tqdm(zip(real_files, fake_files), total=min(len(real_files), len(fake_files)),
                     desc="pitch sim"):
        wav_r, sr = torchaudio.load(str(r))
        wav_f, _ = torchaudio.load(str(f))
        sims.append(pitch_contour_similarity(wav_r.mean(0), wav_f.mean(0), sr=sr))
    metrics["pitch_contour_similarity"] = sum(s for s in sims if s == s) / max(1, sum(1 for s in sims if s == s))

    with open(args.out_json, "w") as f:
        json.dump(metrics, f, indent=2)
    logger.info(f"Metrics → {args.out_json}: {metrics}")


if __name__ == "__main__":
    main()
