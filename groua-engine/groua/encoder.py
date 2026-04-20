"""Text encoder: T5 / CLIP-Text wrapper producing conditioning embeddings."""
from __future__ import annotations

from typing import List

import torch
import torch.nn as nn
from transformers import T5EncoderModel, T5Tokenizer


class TextEncoder(nn.Module):
    """Frozen T5 encoder. Returns sequence embeddings for cross-attention."""

    def __init__(
        self,
        model_name: str = "google/flan-t5-base",
        max_length: int = 128,
        freeze: bool = True,
    ):
        super().__init__()
        self.tokenizer = T5Tokenizer.from_pretrained(model_name)
        self.t5 = T5EncoderModel.from_pretrained(model_name)
        self.max_length = max_length
        self.embedding_dim = self.t5.config.d_model

        if freeze:
            for p in self.t5.parameters():
                p.requires_grad = False
            self.t5.eval()

    @property
    def device(self) -> torch.device:
        return next(self.t5.parameters()).device

    def forward(self, prompts: List[str]) -> torch.Tensor:
        """
        Returns:
            sequence embeddings (B, L, D) for cross-attention conditioning.
        """
        inputs = self.tokenizer(
            prompts,
            padding="max_length",
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        ).to(self.device)
        with torch.no_grad():
            out = self.t5(**inputs).last_hidden_state
        return out  # (B, L, D)

    def pooled(self, prompts: List[str]) -> torch.Tensor:
        """Single vector per prompt (mean pooling), useful as global cond."""
        seq = self.forward(prompts)
        return seq.mean(dim=1)  # (B, D)
