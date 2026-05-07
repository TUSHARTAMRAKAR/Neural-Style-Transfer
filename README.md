<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Playfair+Display&weight=700&size=42&duration=3000&pause=1000&color=519755&center=true&vCenter=true&multiline=false&width=700&height=80&lines=Neural+Style+Transfer+%F0%9F%8E%A8;Where+Pixels+Meet+the+Paintbrush.;Deep+Learning.+Timeless+Art." alt="Neural Style Transfer" />

<br/>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/PyTorch-2.x-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white"/>
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black"/>
  <img src="https://img.shields.io/badge/License-MIT-A8DCAB?style=for-the-badge"/>
</p>

<p align="center">
  <a href="https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer/actions/workflows/ci.yml">
    <img src="https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer/actions/workflows/ci.yml/badge.svg" alt="CI"/>
  </a>
  <a href="https://neural-style-transfer-pied.vercel.app">
    <img src="https://img.shields.io/badge/Vercel-Live_App-000000?style=flat&logo=vercel&logoColor=white"/>
  </a>
  <a href="https://huggingface.co/spaces/Tusharz/Neural-Style-Transfer">
    <img src="https://img.shields.io/badge/🤗_HF_Spaces-Running-FFD21E?style=flat"/>
  </a>
  <a href="https://colab.research.google.com/github/TUSHARTAMRAKAR/Neural-Style-Transfer/blob/main/notebook/nst_colab.ipynb">
    <img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/>
  </a>
</p>

<br/>

<p align="center">
  <a href="https://neural-style-transfer-pied.vercel.app">
    <img src="https://img.shields.io/badge/🌐_Live_Demo-Try_it_Now-519755?style=for-the-badge" alt="Live Demo"/>
  </a>
  &nbsp;
  <a href="https://neural-style-transfer-api.onrender.com/docs">
    <img src="https://img.shields.io/badge/📡_API_Docs-Interactive-DBAAA7?style=for-the-badge" alt="API Docs"/>
  </a>
  &nbsp;
  <a href="https://colab.research.google.com/github/TUSHARTAMRAKAR/Neural-Style-Transfer/blob/main/notebook/nst_colab.ipynb">
    <img src="https://img.shields.io/badge/📓_Notebook-Free_GPU-BE91BE?style=for-the-badge" alt="Notebook"/>
  </a>
</p>

<br/>

> **Transform any photograph into a masterpiece** — powered by VGG-19, Gram matrix optimization,
> and a production-grade full-stack deployment across Vercel, Render, and Hugging Face Spaces.

</div>

---

## ✨ What Is This?

This is a **production-grade Neural Style Transfer web application** that applies the artistic style of famous paintings to your photographs using deep learning — in real time, from your browser.

This isn't a filter. This isn't a preset. This is genuine **iterative pixel optimization** — a frozen VGG-19 convolutional neural network repaints your image pixel-by-pixel, matching the texture statistics of a real painting using Gram matrix decomposition.

```
You upload a photo  +  You pick a painting  →  AI paints your photo in that style
```

---

## 🖼️ Results Gallery

<div align="center">

| Original Photo | Style Reference | Stylized Output |
|:---:|:---:|:---:|
| ![Content](docs/results/content_sample.jpg) | Van Gogh — Starry Night | ![Result](docs/results/result_starry.png) |
| ![Content](docs/results/content_sample2.jpg) | Hokusai — The Great Wave | ![Result](docs/results/result_wave.png) |

</div>

> 📸 **[Try it yourself — upload your own photo](https://neural-style-transfer-pied.vercel.app)**
> The app features a **before/after drag slider** with cinematic blur-reveal effect on every result.
>
> ➕ **Add your own results:** Drop before/after PNGs into `docs/results/` and update this table.

---

## 🧠 The Algorithm — How It Actually Works

Based on the landmark paper:
> **[A Neural Algorithm of Artistic Style](https://arxiv.org/abs/1508.06576)** — Gatys, Ecker & Bethge, 2015

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NEURAL STYLE TRANSFER PIPELINE                         │
├───────────────────┬─────────────────────────────────────────────────────────┤
│                   │          VGG-19  (weights FROZEN — never trained)        │
│  Content Image    │                                                          │
│  (your photo)  ───┼──► conv1_1 ──────────────────────────► style loss ①    │
│                   │  ► conv2_1 ──────────────────────────► style loss ②    │
│  Style Image      │  ► conv3_1 ──────────────────────────► style loss ③    │
│  (the artwork) ───┼──► conv4_1 ──────────────────────────► style loss ④    │
│                   │  ► conv4_2 ──────────────────────────► content loss     │
│                   │  ► conv5_1 ──────────────────────────► style loss ⑤    │
│                   │                                                          │
│                   │  Style loss  = MSE( Gram(F_gen), Gram(F_style) )        │
│                   │  Content loss = MSE( F_gen[4_2], F_content[4_2] )       │
│                   │  Total loss  = α · content_loss + β · style_loss        │
│                   │                                                          │
│  Canvas image ◄───┼── L-BFGS optimizer (minimizes Total loss on PIXELS)    │
│  (starts as       │   ~300-400 iterations                                   │
│   content copy)   │   β/α ≈ 1,000,000  (style dominates)                   │
└───────────────────┴─────────────────────────────────────────────────────────┘
                              ↓
                    Stylized Output ✨
```

### 🔬 The Gram Matrix — The Secret Sauce

The entire style capture mechanism is 3 lines of math:

```python
def gram_matrix(features):              # features shape: [B, C, H, W]
    f = features.view(B * C, H * W)     # flatten spatial dimensions
    return torch.mm(f, f.t()) / (B*C*H*W)  # channel correlation matrix

# Result: C×C matrix where cell[i,j] = "do channels i and j co-activate?"
# → captures TEXTURE STATISTICS, completely ignoring spatial position
# → same Gram matrix = same artistic texture, any composition
```

### ⚡ Why L-BFGS Over Adam?

| Optimizer | Iterations to convergence | Use case |
|-----------|--------------------------|----------|
| SGD | ~10,000+ | Large-scale training |
| Adam | ~2,000+ | Most deep learning |
| **L-BFGS** | **~300–400** | **NST — small problem, needs curvature info** |

L-BFGS uses **quasi-Newton second-order information** — like reading a topographic map instead of walking blindly. For NST's small pixel-space optimization, it converges 5–10× faster than Adam.

---

## 🏗️ System Architecture

```
Browser (React + Vite)
      │
      │  REST API  (JSON + multipart/form-data)
      ▼
FastAPI Backend (Render — Python 3.11)
      │
      ├── POST /stylize ─────────────────────► Background Thread
      │      └─ returns job_id instantly              │
      │                                               │  run_style_transfer()
      ├── GET  /status/{id} ◄── poll / 3s ───────── │  (3–8 min CPU)
      │      └─ progress 0.0 → 1.0                   │
      │                                               │
      └── GET  /result/{id} ◄──── complete ◄─────────┘
             └─ returns stylized PNG

NST Engine (nst_engine.py)
      ├── load_image()           PIL → normalized tensor [1,3,H,W]
      ├── ContentLoss            MSE on conv4_2 feature maps
      ├── StyleLoss              MSE on Gram matrices (5 layers)
      ├── build_model_and_losses() VGG-19 with loss modules inserted inline
      └── run_style_transfer()   L-BFGS loop, progress callbacks
```

---

## 📁 Project Structure

```
neural-style-transfer/
│
├── 🐍 backend/
│   ├── main.py                # FastAPI — 6 endpoints, async job queue
│   ├── nst_engine.py          # VGG-19 NST core — content/style loss, L-BFGS
│   ├── download_styles.py     # Downloads 6 public domain artworks
│   ├── requirements.txt
│   ├── .python-version        # Pins Python 3.11 for Render
│   ├── uploads/               # Temp storage for incoming images
│   ├── outputs/               # Generated stylized results
│   └── style_images/          # 6 preset masterworks (local only)
│
├── ⚛️  frontend/
│   ├── src/
│   │   ├── App.jsx            # State machine: idle → processing → done
│   │   ├── index.css          # Wildflowers palette + dark/light mode vars
│   │   ├── components/
│   │   │   ├── UploadPanel.jsx    # Drag-and-drop with live preview
│   │   │   ├── StyleGallery.jsx   # 6-card preset art style picker
│   │   │   └── ResultViewer.jsx   # Before/after blur-reveal slider + download
│   │   ├── hooks/
│   │   │   └── useJobPoller.js    # Polls /status every 3s (custom hook)
│   │   └── utils/
│   │       └── api.js             # All API calls in one place
│   ├── public/style_images/   # Thumbnails served by Vercel CDN
│   ├── vercel.json            # Vercel deployment config
│   └── .env.production        # Points to Render backend URL
│
├── 📓 notebook/
│   └── nst_colab.ipynb        # GPU notebook — visualizes Gram matrices + loss curves
│
├── 🤗 spaces/
│   └── app.py                 # Gradio UI for Hugging Face Spaces deployment
│
├── ⚙️  .github/
│   ├── workflows/ci.yml       # Test → Build → Deploy on every push to main
│   ├── CONTRIBUTING.md
│   ├── ISSUE_TEMPLATE.md
│   └── PULL_REQUEST_TEMPLATE.md
│
├── 📚 docs/
│   ├── ARCHITECTURE.md        # Deep-dive system design
│   └── results/               # Before/after example images
│
├── requirements.txt           # Root — used by Hugging Face Spaces
├── .gitignore
├── LICENSE                    # MIT
└── README.md                  ← you are here
```

---

## 🚀 Quick Start

### ☁️ Zero Setup — Use The Live App

| Platform | URL | Notes |
|----------|-----|-------|
| 🌐 **Vercel** (React App) | [neural-style-transfer-pied.vercel.app](https://neural-style-transfer-pied.vercel.app) | Full UI, before/after slider |
| 📡 **Render** (API) | [neural-style-transfer-api.onrender.com/docs](https://neural-style-transfer-api.onrender.com/docs) | Interactive Swagger docs |
| 🤗 **HF Spaces** (Gradio) | [huggingface.co/spaces/Tusharz/Neural-Style-Transfer](https://huggingface.co/spaces/Tusharz/Neural-Style-Transfer) | ML community demo |
| 📓 **Colab** (Free GPU) | [Open Notebook](https://colab.research.google.com/github/TUSHARTAMRAKAR/Neural-Style-Transfer/blob/main/notebook/nst_colab.ipynb) | T4 GPU, 30 sec/image |

### 💻 Run Locally

**Prerequisites:** Python 3.10+ · Node.js 18+ · Git

```bash
# 1. Clone
git clone https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer.git
cd neural-style-transfer

# 2. Backend — Terminal 1
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python download_styles.py       # Downloads 6 artworks automatically
uvicorn main:app --reload --port 8000

# 3. Frontend — Terminal 2
cd frontend
npm install --legacy-peer-deps
npm run dev
```

| URL | What |
|-----|------|
| `http://localhost:5173` | React web app |
| `http://localhost:8000/docs` | FastAPI interactive docs |

---

## 📡 API Reference

All endpoints are documented interactively at `/docs` (auto-generated by FastAPI).

```
GET  /              → Health check
GET  /styles        → List 6 preset artworks with metadata
POST /stylize       → Submit job → returns job_id immediately
GET  /status/{id}   → Poll progress (0.0 → 1.0) + loss metrics
GET  /result/{id}   → Download stylized PNG
DEL  /job/{id}      → Clean up uploaded files
GET  /jobs          → List all jobs (debug)
```

### Full Flow Example

```bash
# 1. Submit job
curl -X POST https://neural-style-transfer-api.onrender.com/stylize \
  -F "content_image=@photo.jpg" \
  -F "preset=starry_night" \
  -F "num_steps=300"

# Response:
# { "job_id": "f3a2b1c4-...", "status": "pending" }

# 2. Poll until complete
curl https://neural-style-transfer-api.onrender.com/status/f3a2b1c4-...
# { "status": "processing", "progress": 0.47, "step": 141, "total_steps": 300,
#   "content_loss": 1423.5, "style_loss": 98234.1 }

# 3. Download result
curl https://neural-style-transfer-api.onrender.com/result/f3a2b1c4-... \
  --output stylized.png
```

---

## 🎨 Style Presets & Tuned Settings

| Key | Artwork | Artist | Year | Content Weight | Style Weight |
|-----|---------|--------|------|---------------|-------------|
| `starry_night` | The Starry Night | Van Gogh | 1889 | 1×10³ | 1×10⁹ |
| `the_scream` | The Scream | Edvard Munch | 1893 | 1×10³ | 8×10⁸ |
| `kandinsky` | Composition VIII | Kandinsky | 1923 | 5×10² | 1.5×10⁹ |
| `mosaic` | Ravenna Mosaic | Byzantine | 6th c. | 1×10³ | 1.2×10⁹ |
| `wave` | The Great Wave | Hokusai | 1831 | 1×10³ | 9×10⁸ |
| `udnie` | Udnie | Picabia | 1913 | 5×10² | 1×10⁹ |

### Subject Mode Cheat Sheet

```
🧑 Portrait   → steps: 300  · style: 80M   · content: 15K  (face preserved ✅)
🌄 Landscape  → steps: 400  · style: 400M  · content: 5K   (bold effect ✅)
🎨 Max Style  → steps: 400  · style: 900M  · content: 1K   (full artistic ✅)
```

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Technology | Version | Why This Choice |
|-------|-----------|---------|----------------|
| **AI Core** | PyTorch | 2.x | Industry standard, autograd, VGG-19 pretrained |
| **Model** | VGG-19 (ImageNet) | Pretrained | Sequential layers ideal for NST feature extraction |
| **Backend** | FastAPI | 0.110 | Async-native, auto-docs, Pydantic validation |
| **Server** | Uvicorn | 0.27 | ASGI, production-grade, supports `--reload` |
| **Frontend** | React | 18 | Component model, hooks, ecosystem |
| **Build** | Vite | 5.4 | 10× faster than CRA, HMR, tree-shaking |
| **Styling** | TailwindCSS | 3.4 | Utility-first, no CSS bloat |
| **Fonts** | Playfair Display + Inter + JetBrains Mono | — | Elegant display + clean body + precise mono |
| **Notebook** | Jupyter + Colab | — | Free T4 GPU, shareable, Gram matrix visualizations |
| **Frontend Deploy** | Vercel | — | Global CDN, instant deploy, env vars, free |
| **Backend Deploy** | Render | — | Docker-compatible, Python support, free tier |
| **ML Demo** | Hugging Face Spaces | — | Gradio, ML community, free CPU |
| **CI/CD** | GitHub Actions | — | Auto test + auto deploy on every push |

</div>

---

## 🔬 Key Technical Decisions

<details>
<summary><b>Why VGG-19 over ResNet, EfficientNet, or Vision Transformers?</b></summary>

VGG-19's **simple sequential architecture** is essential for NST. We need to insert loss modules at specific intermediate layers and collect gradients — ResNet's skip connections and ViT's attention blocks would complicate the gradient flow dramatically. VGG's uniform conv→relu→pool structure gives us clean, hierarchical feature maps that perfectly separate low-level texture (early layers) from high-level structure (deep layers).

</details>

<details>
<summary><b>Why L-BFGS over Adam for optimization?</b></summary>

NST is an unusually **small optimization problem** — we're adjusting ~590K pixels (512×512×3) rather than millions of network parameters. L-BFGS's quasi-Newton line search with `strong_wolfe` conditions uses curvature information to take larger, smarter steps. It converges in ~300 iterations vs ~2000 for Adam. The `max_iter=20` inner loop per step makes each outer iteration expensive but the total wall-clock time is dramatically lower.

</details>

<details>
<summary><b>Why does style_weight need to be 1,000,000× content_weight?</b></summary>

Raw MSE on content features (conv4_2: 512 channels × 32×32 = 524,288 values) produces much larger gradients than style loss (Gram matrix: 64×64 = 4,096 values per layer). Without the extreme ratio, content loss dominates and the result looks like "just contrast adjustment." The `β/α ≈ 1e6` ratio is what produces visible artistic transformation vs a subtle filter effect.

</details>

<details>
<summary><b>Why async job queue instead of synchronous response?</b></summary>

Style transfer takes 3–8 minutes on CPU. A synchronous HTTP response would timeout (default 30s), block the server thread, and give zero user feedback. The **async job pattern** — return `job_id` immediately, run NST in a background thread, poll `/status/{id}` every 3 seconds — is the correct architecture for any slow computation. It's what YouTube, Cloudinary, and every video/image processing service uses.

</details>

<details>
<summary><b>Why AvgPool instead of MaxPool in VGG-19?</b></summary>

We replace all `MaxPool2d` layers with `AvgPool2d` in the loss network. MaxPooling creates sharp edges in the gradient flow that produce visible artifacts in the stylized output. Average pooling produces smoother gradients → cleaner, more painterly results. This detail is from the original Gatys et al. paper and makes a visible quality difference.

</details>

---

## 📊 Performance Benchmarks

| Hardware | Image Size | Steps | Time | Quality |
|----------|-----------|-------|------|---------|
| CPU (Intel i7-12th gen) | 256×256 | 300 | ~3 min | Good |
| CPU (Intel i7-12th gen) | 384×384 | 400 | ~8 min | Great |
| GPU (T4 — Colab free) | 512×512 | 400 | ~35 sec | Excellent |
| GPU (RTX 3080) | 512×512 | 400 | ~12 sec | Excellent |
| GPU (A100 — Colab Pro) | 1024×1024 | 500 | ~45 sec | Maximum |

---

## 🌐 Deployment Architecture

```
GitHub (source of truth)
    │
    ├──► GitHub Actions CI
    │         ├── Backend tests (Python)
    │         ├── Frontend build (Vite)
    │         └── Lint checks
    │
    ├──► Vercel (automatic on push to main)
    │         └── React frontend → global CDN
    │               env: VITE_API_URL=https://neural-style-transfer-api.onrender.com
    │
    ├──► Render (automatic on push to main)
    │         └── FastAPI backend → Python 3.11
    │               uvicorn main:app --host 0.0.0.0 --port $PORT
    │
    └──► Hugging Face Spaces (git push hf main)
              └── Gradio app → spaces/app.py
                    downloads style images at startup from GitHub raw URLs
```

---

## 🤝 Contributing

Contributions are very welcome! Here's how:

```bash
# Fork → Clone → Branch
git checkout -b feature/your-feature

# Make changes, then test
cd backend && python nst_engine.py          # smoke tests
cd frontend && npm run build                # build check

# Commit with conventional commits
git commit -m "feat: add your feature"
git commit -m "fix: fix the thing"
git commit -m "docs: update readme"

# Push and open PR
git push origin feature/your-feature
```

**Ideas for contributions:**
- Fast NST (feed-forward network — 100× faster inference)
- WebSocket real-time progress instead of polling
- User authentication + result history
- Additional style presets
- Mobile PWA wrapper

---

## 📚 References

| Resource | Link |
|----------|------|
| Original NST paper | [Gatys et al., 2015 — arxiv.org/abs/1508.06576](https://arxiv.org/abs/1508.06576) |
| Fast NST paper | [Johnson et al., 2016 — arxiv.org/abs/1603.08155](https://arxiv.org/abs/1603.08155) |
| VGG paper | [Simonyan & Zisserman, 2014 — arxiv.org/abs/1409.1556](https://arxiv.org/abs/1409.1556) |
| PyTorch NST tutorial | [pytorch.org/tutorials/advanced/neural_style_tutorial](https://pytorch.org/tutorials/advanced/neural_style_tutorial.html) |
| FastAPI docs | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) |
| Vercel docs | [vercel.com/docs](https://vercel.com/docs) |

---

## 📄 License

Distributed under the **MIT License** — see [LICENSE](LICENSE) for details.

Free to use, modify, and distribute. Attribution appreciated but not required.

---

<div align="center">

**Built with passion · Deployed with precision · Painted with algorithms**

<br/>

<img src="https://img.shields.io/badge/Sage-A8DCAB?style=for-the-badge&color=A8DCAB&labelColor=A8DCAB&label="/>
<img src="https://img.shields.io/badge/Forest-519755?style=for-the-badge&color=519755&labelColor=519755&label="/>
<img src="https://img.shields.io/badge/Rose-DBAAA7?style=for-the-badge&color=DBAAA7&labelColor=DBAAA7&label="/>
<img src="https://img.shields.io/badge/Mauve-BE91BE?style=for-the-badge&color=BE91BE&labelColor=BE91BE&label="/>

<br/><br/>

<img src="https://github.com/TUSHARTAMRAKAR.png" width="80" height="80" style="border-radius:50%" alt="Tushar Tamrakar"/>

<br/>

Made with ❤️ by **[Tushar Tamrakar](https://github.com/TUSHARTAMRAKAR)**

<p>
  <a href="https://github.com/TUSHARTAMRAKAR">
    <img src="https://img.shields.io/github/followers/TUSHARTAMRAKAR?label=Follow&style=social"/>
  </a>
  &nbsp;
  <a href="https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer">
    <img src="https://img.shields.io/github/stars/TUSHARTAMRAKAR/Neural-Style-Transfer?style=social"/>
  </a>
</p>

*If this project helped you, please consider giving it a ⭐ — it means a lot!*

<br/>

[![Star History Chart](https://api.star-history.com/svg?repos=TUSHARTAMRAKAR/Neural-Style-Transfer&type=Date)](https://star-history.com/#TUSHARTAMRAKAR/Neural-Style-Transfer&Date)

</div>
