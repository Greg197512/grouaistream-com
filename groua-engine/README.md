# 🎵 GrouAI Music Engine

Własny silnik AI do generowania muzyki z tekstu — architektura w stylu Suno / AudioLDM2 / MusicGen.
Pełny pipeline od surowego audio do generowanej fali, gotowy do treningu na GPU.

> **Uwaga**: To jest fundament treningowy. Repo działa **lokalnie lub na GPU cloud (RunPod, Lambda, Vast.ai)**.
> Integracja z aplikacją GrouAI Stream (Replicate API / własny endpoint) zostanie dodana w osobnym kroku.

---

## 🧠 Architektura

```
+-------------------+      +------------------+      +------------------+
|   Prompt (txt)    | ---> |   Text Encoder   | ---> |   Conditioning   |
|  "peaceful piano" |      |   (T5 / CLIP-T)  |      |   (cross-attn)   |
+-------------------+      +------------------+      +------------------+
                                                              |
                                                              v
                               +------------------+    +------------------+
                               |  Diffusion U-Net | <- |   Latent (z)     |
                               | (latent diffusion)|    +------------------+
                               +------------------+
                                       |
                                       v
+-------------------+      +------------------+      +------------------+
|   Mel-Spectrogram | <--- |  Latent Decoder  |      |   Mel-Vocoder    |
|   (latent space)  |      |  (VQ-VAE decode) | ---> |   (HiFi-GAN)     |
+-------------------+      +------------------+      +------------------+
                                                              |
                                                              v
                                                    +------------------+
                                                    |    Waveform      |
                                                    |   (16-bit PCM)   |
                                                    +------------------+
```

---

## 📂 Struktura projektu

```
groua-engine/
├── configs/                  # YAML z hiperparametrami
│   ├── model.yaml
│   ├── training.yaml
│   └── inference.yaml
├── data/
│   ├── raw/                  # Surowe audio + CSV z promptami
│   └── processed/            # Wstępnie przetworzone mel + tokeny
├── groua/                    # Główny pakiet Python
│   ├── __init__.py
│   ├── encoder.py            # T5 / CLIP-Text wrapper
│   ├── autoencoder.py        # VQ-VAE (audio ↔ latent)
│   ├── diffusion.py          # U-Net + DDPM/DDIM
│   ├── vocoder.py            # HiFi-GAN wrapper
│   ├── model.py              # Spina wszystko w jeden pipeline
│   └── utils.py              # mel↔wav, logging, schedulers
├── scripts/
│   ├── prepare_data.py       # 1️⃣ Etap: przygotowanie datasetu
│   ├── train_autoencoder.py  # 2️⃣ Etap: trening VQ-VAE
│   ├── train_diffusion.py    # 3️⃣ Etap: trening diffusion
│   ├── train_vocoder.py      # 4️⃣ Etap: fine-tune HiFi-GAN
│   ├── evaluate.py           # 5️⃣ Etap: FAD, MUSHRA, pitch metrics
│   ├── generate.py           # CLI inference
│   └── export_onnx.py        # 7️⃣ Etap: eksport do produkcji
├── app/
│   └── api.py                # 6️⃣ Etap: FastAPI endpoint /generate
├── requirements.txt
├── Dockerfile                # Środowisko CUDA-ready
└── README.md
```

---

## 🏃 Pipeline treningowy — 7 etapów

| # | Etap | Skrypt | Czas (1×A100) | Output |
|---|------|--------|---------------|--------|
| 1 | Przygotowanie danych | `prepare_data.py` | 2-6 h | mel-spec + CSV |
| 2 | Trening VQ-VAE | `train_autoencoder.py` | 1-3 dni | `autoencoder.pt` |
| 3 | Trening diffusion | `train_diffusion.py` | 5-14 dni | `diffusion.pt` |
| 4 | Fine-tune HiFi-GAN | `train_vocoder.py` | 1-2 dni | `vocoder.pt` |
| 5 | Ewaluacja | `evaluate.py` | 1-2 h | `metrics.json` |
| 6 | API inference | `app/api.py` | — | `localhost:8000/generate` |
| 7 | Deploy / ONNX | `export_onnx.py` | 30 min | `groua_music.onnx` |

---

## 🚀 Quickstart

### 1. Instalacja
```bash
cd groua-engine
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Przygotuj dane
Stwórz `data/raw/meta.csv` z kolumnami: `audio_path,prompt,genre,bpm`

```bash
python scripts/prepare_data.py \
  --meta_csv data/raw/meta.csv \
  --out_dir  data/processed/
```

### 3. Trening (kolejno)
```bash
python scripts/train_autoencoder.py --config configs/model.yaml --epochs 100
python scripts/train_diffusion.py   --config configs/model.yaml --epochs 200
python scripts/train_vocoder.py     --config configs/model.yaml --epochs 50
```

### 4. Generowanie
```bash
python scripts/generate.py \
  --prompt "dark cinematic synthwave with deep bass" \
  --duration 30 \
  --out output.wav
```

### 5. Serwowanie API
```bash
uvicorn app.api:app --host 0.0.0.0 --port 8000
# POST /generate  body: {"prompt": "...", "duration": 30}
```

---

## 🌍 Rekomendowane środowiska treningowe

| Platforma | GPU | Cena/h | Najlepsze do |
|-----------|-----|--------|--------------|
| **RunPod** | RTX 4090 / A100 | $0.40-2.00 | Eksperymenty, szybki trening |
| **Lambda Labs** | H100 / A100 | $2-3 | Produkcyjny trening |
| **Vast.ai** | dowolne | $0.20-1.50 | Tani trening, mniej stabilne |
| **Replicate** | A40 / A100 | $0.001/s | Hosting + fine-tune |

---

## 📊 Datasety publiczne

- **MusicCaps** (Google) — 5.5k klipów z opisami → https://www.kaggle.com/datasets/googleai/musiccaps
- **AudioSet** — 2M klipów z YouTube z tagami → https://research.google.com/audioset/
- **FMA** (Free Music Archive) — 100k+ utworów CC → https://github.com/mdeff/fma
- **Jamendo** — pełne utwory CC → https://mtg.github.io/mtg-jamendo-dataset/

---

## 🔧 Następne kroki integracji z GrouAI Stream

Po wytrenowaniu modelu:
1. Eksport do ONNX → upload na **Replicate** lub **HuggingFace Hub**
2. Stworzenie edge function `groua-music-engine` w głównym projekcie
3. Podmiana `suno-generate` na własny model w UI
4. Telemetria + cache w bazie GrouAI

---

**Made with ❤️ for GrouAI Stream**
