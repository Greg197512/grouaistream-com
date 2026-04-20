"""6️⃣ FastAPI inference server. Endpoint: POST /generate"""
from __future__ import annotations

import io
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import torch
import torchaudio
import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from groua.utils import get_logger
from scripts.generate import load_model

logger = get_logger("api")


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=512)
    duration: float = Field(30.0, gt=0.5, le=120.0)
    steps: int = Field(50, ge=10, le=200)
    guidance: float = Field(7.5, ge=1.0, le=20.0)
    seed: Optional[int] = None


# Lazy-loaded global model
_state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg_path = Path("configs/model.yaml")
    inf_path = Path("configs/inference.yaml")
    if not cfg_path.exists():
        raise RuntimeError(f"Missing {cfg_path}")
    with open(cfg_path) as f:
        mcfg = yaml.safe_load(f)
    with open(inf_path) as f:
        icfg = yaml.safe_load(f)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Loading model on {device}...")
    _state["model"] = load_model(mcfg, icfg, device)
    _state["mcfg"] = mcfg
    _state["icfg"] = icfg
    _state["device"] = device
    logger.info("Model ready.")
    yield
    _state.clear()


app = FastAPI(title="GrouAI Music Engine", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "device": str(_state.get("device", "unknown"))}


@app.post("/generate")
def generate(req: GenerateRequest):
    if "model" not in _state:
        raise HTTPException(503, "Model not loaded")

    model = _state["model"]
    mcfg = _state["mcfg"]

    try:
        wav = model.generate(
            prompts=[req.prompt],
            duration_sec=req.duration,
            sample_rate=mcfg["audio"]["sample_rate"],
            hop_length=mcfg["audio"]["hop_length"],
            downsample=mcfg["autoencoder"]["downsample_factor"],
            num_steps=req.steps,
            guidance_scale=req.guidance,
            seed=req.seed,
        )
    except Exception as e:
        logger.exception("generation failed")
        raise HTTPException(500, f"Generation failed: {e}")

    buf = io.BytesIO()
    torchaudio.save(buf, wav.cpu(), sample_rate=mcfg["audio"]["sample_rate"], format="wav")
    buf.seek(0)
    return StreamingResponse(buf, media_type="audio/wav",
                             headers={"Content-Disposition": f'attachment; filename="groua-{req.seed or 0}.wav"'})
