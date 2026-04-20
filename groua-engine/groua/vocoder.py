"""HiFi-GAN vocoder wrapper: mel-spectrogram → waveform."""
from __future__ import annotations

from typing import List, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.nn.utils import weight_norm


LRELU_SLOPE = 0.1


def init_weights(m, mean: float = 0.0, std: float = 0.01):
    if isinstance(m, (nn.Conv1d, nn.ConvTranspose1d)):
        m.weight.data.normal_(mean, std)


class ResBlock(nn.Module):
    def __init__(self, channels: int, kernel: int = 3, dilations=(1, 3, 5)):
        super().__init__()
        self.convs1 = nn.ModuleList([
            weight_norm(nn.Conv1d(channels, channels, kernel,
                                  dilation=d, padding=(kernel - 1) * d // 2))
            for d in dilations
        ])
        self.convs2 = nn.ModuleList([
            weight_norm(nn.Conv1d(channels, channels, kernel,
                                  dilation=1, padding=(kernel - 1) // 2))
            for _ in dilations
        ])
        self.convs1.apply(init_weights)
        self.convs2.apply(init_weights)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for c1, c2 in zip(self.convs1, self.convs2):
            xt = F.leaky_relu(x, LRELU_SLOPE)
            xt = c1(xt)
            xt = F.leaky_relu(xt, LRELU_SLOPE)
            xt = c2(xt)
            x = xt + x
        return x


class HiFiGANVocoder(nn.Module):
    """Generator-only HiFi-GAN. For training, pair with MultiPeriod/Scale Discriminators."""

    def __init__(
        self,
        n_mels: int = 80,
        upsample_rates: Tuple[int, ...] = (8, 8, 2, 2),
        upsample_kernel_sizes: Tuple[int, ...] = (16, 16, 4, 4),
        upsample_initial_channel: int = 512,
        resblock_kernel_sizes: Tuple[int, ...] = (3, 7, 11),
        resblock_dilations=((1, 3, 5), (1, 3, 5), (1, 3, 5)),
    ):
        super().__init__()
        self.num_kernels = len(resblock_kernel_sizes)
        self.num_upsamples = len(upsample_rates)
        self.conv_pre = weight_norm(nn.Conv1d(n_mels, upsample_initial_channel, 7, padding=3))

        self.ups = nn.ModuleList()
        for i, (u, k) in enumerate(zip(upsample_rates, upsample_kernel_sizes)):
            self.ups.append(weight_norm(nn.ConvTranspose1d(
                upsample_initial_channel // (2 ** i),
                upsample_initial_channel // (2 ** (i + 1)),
                kernel_size=k, stride=u, padding=(k - u) // 2,
            )))

        self.resblocks = nn.ModuleList()
        for i in range(self.num_upsamples):
            ch = upsample_initial_channel // (2 ** (i + 1))
            for k, d in zip(resblock_kernel_sizes, resblock_dilations):
                self.resblocks.append(ResBlock(ch, k, d))

        self.conv_post = weight_norm(nn.Conv1d(ch, 1, 7, padding=3))
        self.ups.apply(init_weights)
        self.conv_post.apply(init_weights)

    def forward(self, mel: torch.Tensor) -> torch.Tensor:
        """
        mel: (B, n_mels, T)
        return: (B, 1, T * prod(upsample_rates))
        """
        x = self.conv_pre(mel)
        for i in range(self.num_upsamples):
            x = F.leaky_relu(x, LRELU_SLOPE)
            x = self.ups[i](x)
            xs = None
            for j in range(self.num_kernels):
                if xs is None:
                    xs = self.resblocks[i * self.num_kernels + j](x)
                else:
                    xs = xs + self.resblocks[i * self.num_kernels + j](x)
            x = xs / self.num_kernels
        x = F.leaky_relu(x)
        x = torch.tanh(self.conv_post(x))
        return x

    def remove_weight_norm(self):
        for layer in self.ups:
            torch.nn.utils.remove_weight_norm(layer)
        for layer in self.resblocks:
            for c in layer.convs1:
                torch.nn.utils.remove_weight_norm(c)
            for c in layer.convs2:
                torch.nn.utils.remove_weight_norm(c)
        torch.nn.utils.remove_weight_norm(self.conv_pre)
        torch.nn.utils.remove_weight_norm(self.conv_post)
