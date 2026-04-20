"""7️⃣ Export trained components to ONNX for production runtime."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import torch
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from groua.autoencoder import VQVAEAutoencoder
from groua.diffusion import DiffusionUNet
from groua.utils import get_logger
from groua.vocoder import HiFiGANVocoder

logger = get_logger("export_onnx")


def export_module(module: torch.nn.Module, dummy_inputs: tuple, out_path: Path,
                  input_names, output_names, dynamic_axes):
    module.eval()
    torch.onnx.export(
        module,
        dummy_inputs,
        str(out_path),
        opset_version=17,
        do_constant_folding=True,
        input_names=input_names,
        output_names=output_names,
        dynamic_axes=dynamic_axes,
    )
    logger.info(f"Exported → {out_path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="configs/model.yaml")
    ap.add_argument("--inference_config", default="configs/inference.yaml")
    ap.add_argument("--out_dir", default="./onnx")
    args = ap.parse_args()

    with open(args.config) as f:
        mcfg = yaml.safe_load(f)
    with open(args.inference_config) as f:
        icfg = yaml.safe_load(f)

    device = torch.device("cpu")  # ONNX export on CPU is most portable
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    ae_cfg = mcfg["autoencoder"]
    diff_cfg = mcfg["diffusion"]
    voc_cfg = mcfg["vocoder"]

    # ---- Autoencoder decoder ----
    ae = VQVAEAutoencoder(
        in_channels=1,
        latent_channels=ae_cfg["latent_channels"],
        hidden_channels=ae_cfg["hidden_channels"],
        codebook_size=ae_cfg["codebook_size"],
    )
    ae.load_state_dict(torch.load(icfg["checkpoints"]["autoencoder"], map_location="cpu")["model"])
    z = torch.randn(1, ae_cfg["latent_channels"], 20, 256)
    export_module(ae.decoder, (z,), out_dir / "autoencoder_decoder.onnx",
                  input_names=["latent"], output_names=["mel"],
                  dynamic_axes={"latent": {0: "B", 2: "H", 3: "W"},
                                "mel": {0: "B", 2: "H", 3: "W"}})

    # ---- Diffusion U-Net ----
    unet = DiffusionUNet(
        latent_channels=ae_cfg["latent_channels"],
        base_channels=diff_cfg["unet_base_channels"],
        channel_mults=diff_cfg["unet_channel_mults"],
        time_emb_dim=diff_cfg["time_embedding_dim"],
        context_dim=mcfg["text_encoder"]["embedding_dim"],
        num_heads=diff_cfg["num_heads"],
    )
    ck = torch.load(icfg["checkpoints"]["diffusion"], map_location="cpu")
    unet.load_state_dict(ck.get("ema", ck["model"]))
    x = torch.randn(1, ae_cfg["latent_channels"], 20, 256)
    t = torch.zeros(1, dtype=torch.long)
    ctx = torch.randn(1, 128, mcfg["text_encoder"]["embedding_dim"])
    export_module(unet, (x, t, ctx), out_dir / "diffusion_unet.onnx",
                  input_names=["latent", "timestep", "context"],
                  output_names=["noise"],
                  dynamic_axes={"latent": {0: "B", 2: "H", 3: "W"},
                                "context": {0: "B", 1: "L"},
                                "noise": {0: "B", 2: "H", 3: "W"}})

    # ---- Vocoder ----
    voc = HiFiGANVocoder(
        n_mels=mcfg["audio"]["n_mels"],
        upsample_rates=tuple(voc_cfg["upsample_rates"]),
        upsample_kernel_sizes=tuple(voc_cfg["upsample_kernel_sizes"]),
        resblock_kernel_sizes=tuple(voc_cfg["resblock_kernel_sizes"]),
        resblock_dilations=tuple(tuple(d) for d in voc_cfg["resblock_dilation_sizes"]),
    )
    voc.load_state_dict(torch.load(icfg["checkpoints"]["vocoder"], map_location="cpu")["model"])
    voc.remove_weight_norm()
    mel = torch.randn(1, mcfg["audio"]["n_mels"], 256)
    export_module(voc, (mel,), out_dir / "vocoder.onnx",
                  input_names=["mel"], output_names=["wav"],
                  dynamic_axes={"mel": {0: "B", 2: "T"}, "wav": {0: "B", 2: "T"}})

    logger.info("All ONNX exports complete.")


if __name__ == "__main__":
    main()
