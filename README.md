<div align="center">

<!-- Animated title using SVG -->
<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=40&duration=3000&pause=1000&color=6366F1&center=true&vCenter=true&multiline=true&width=600&height=100&lines=Neural+Style+Transfer;Turn+Photos+into+Art+%F0%9F%8E%A8" alt="Neural Style Transfer" />

<br/>

<p align="center">
  <strong>A production-grade deep learning web application that transforms ordinary photographs into extraordinary artworks — powered by VGG-19, PyTorch, FastAPI, and React.</strong>
</p>

<br/>

<!-- Badges row 1 -->
<p align="center">
  <a href="https://github.com/TUSHARTAMRAKAR/neural-style-transfer/actions/workflows/ci.yml">
    <img src="https://github.com/TUSHARTAMRAKAR/neural-style-transfer/actions/workflows/ci.yml/badge.svg" alt="CI Status"/>
  </a>
  <a href="https://huggingface.co/spaces/Tusharz/Neural-Style-Transfer">
    <img src="https://img.shields.io/badge/🤗%20Hugging%20Face-Spaces-FFD21E?style=flat" alt="HF Spaces"/>
  </a>
  <a href="https://colab.research.google.com/github/TUSHARTAMRAKAR/neural-style-transfer/blob/main/notebook/nst_colab.ipynb">
    <img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/>
  </a>
</p>

<!-- Badges row 2 -->
<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/PyTorch-2.2-EE4C2C?style=flat&logo=pytorch&logoColor=white" alt="PyTorch"/>
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?style=flat&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/License-MIT-F59E0B?style=flat" alt="License"/>
</p>

<br/>

<!-- Demo links -->
<p align="center">
  <a href="https://huggingface.co/spaces/Tusharz/Neural-Style-Transfer">
    <img src="https://img.shields.io/badge/🌐 Live Demo-Try it now-6366F1?style=for-the-badge" alt="Live Demo"/>
  </a>
  &nbsp;&nbsp;
  <a href="https://colab.research.google.com/github/TUSHARTAMRAKAR/neural-style-transfer/blob/main/notebook/nst_colab.ipynb">
    <img src="https://img.shields.io/badge/📓 Notebook-Run on GPU-F97316?style=for-the-badge" alt="Notebook"/>
  </a>
  &nbsp;&nbsp;
  <a href="http://localhost:8000/docs">
    <img src="https://img.shields.io/badge/📡 API Docs-FastAPI-009688?style=for-the-badge" alt="API Docs"/>
  </a>
</p>

</div>

---

## ✨ What This Does

> Upload **any photograph** + pick a **master artwork** → watch deep learning paint your photo in that exact artistic style. In minutes, not months.

This isn't a filter. This isn't a preset LUT. This is genuine **neural style transfer** — a VGG-19 convolutional neural network iteratively repaints your image at the pixel level, matching the texture statistics of a real painting using Gram matrix optimization.

---

## 🖼️ Results

<div align="center">

| Original Photo | Style | Stylized Result |
|:-:|:-:|:-:|
| ![Original](docs/results/content_sample.jpg) | Van Gogh — Starry Night | ![Stylized](docs/results/result_starry.png) |
| ![Original](docs/results/content_sample2.jpg) | Hokusai — The Great Wave | ![Stylized](docs/results/result_wave.png) |

> 📸 **Replace the images in `docs/results/` with your own before/after photos!**
> Name them exactly: `content_sample.jpg`, `result_starry.png` etc.

### ✨ Live Demo
Try it yourself at **[neural-style-transfer-pied.vercel.app](https://neural-style-transfer-pied.vercel.app)**

The app features a **before/after comparison slider** — drag to reveal the transformation!

</div>

---

## 🧠 How It Actually Works

Based on the landmark paper: **[A Neural Algorithm of Artistic Style](https://arxiv.org/abs/1508.06576)** — Gatys, Ecker & Bethge, 2015.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     NEURAL STYLE TRANSFER PIPELINE                  │
├──────────────────┬──────────────────┬──────────────────────────────-┤
│  Content Image   │   Style Image    │      VGG-19 (frozen)          │
│  (your photo)    │   (the artwork)  │                               │
│       │          │       │          │  conv1_1 → style loss ①      │
│       └──────────┴───────┘          │  conv2_1 → style loss ②      │
│                  │                  │  conv3_1 → style loss ③      │
│          Forward pass               │  conv4_1 → style loss ④      │
│                  │                  │  conv4_2 → content loss       │
│                  ▼                  │  conv5_1 → style loss ⑤      │
│         Feature extraction          │                               │
│                  │                  │  Style   = Gram matrices      │
│       ┌──────────┴───────┐          │  Content = Feature maps MSE   │
│       │                  │          │                               │
│  Content Loss       Style Loss      │  Total Loss =                 │
│  MSE(features)   MSE(gram mats)     │  α·L_content + β·L_style     │
│       │                  │          │                               │
│       └──────────┬───────┘          │  β/α ratio = 1,000,000       │
│                  │                  │  (style dominates)            │
│            Total Loss               │                               │
│                  │                  └──────────────────────────────-┘
│          L-BFGS Optimizer           
│     (optimizes PIXELS, not weights)
│                  │                  
│          ┌───────▼──────┐           
│          │  Canvas IMG  │  ← starts as content image copy          
│          │  (requires   │  ← gradient flows into pixel values      
│          │   grad=True) │  ← 400 iterations of refinement          
│          └───────┬──────┘           
│                  │                  
│          Stylized Output  🎨        
└─────────────────────────────────────────────────────────────────────┘
```

### The Gram Matrix — The Secret Sauce

```python
# This 3-line function is the entire secret of style capture
def gram_matrix(features):              # features: [B, C, H, W]
    f = features.view(B*C, H*W)         # flatten spatial dims
    return torch.mm(f, f.t()) / (B*C*H*W)  # channel correlations

# Result: a C×C matrix where cell[i][j] = "do channels i and j
#         fire together?" → captures texture, NOT position
# Same Gram matrix = same artistic texture, any layout
```

### Why L-BFGS Over Adam?

| Optimizer | Steps to convergence | Memory | Best for |
|-----------|---------------------|--------|----------|
| SGD | ~10,000+ | Low | Large model training |
| Adam | ~2,000+ | Medium | Most deep learning |
| **L-BFGS** | **~400** | Higher | **NST — small problem, needs precision** |

L-BFGS uses second-order curvature information (like reading a topographic map instead of walking blindly). For NST with its small optimization space, it converges ~5x faster than Adam.

---

## 🏗️ Architecture

```
neural-style-transfer/
│
├── 🐍 backend/                     Python · FastAPI · PyTorch
│   ├── main.py                     REST API — 6 endpoints, async job queue
│   ├── nst_engine.py               VGG-19 NST — content loss, style loss, L-BFGS
│   ├── requirements.txt
│   ├── uploads/                    Temp storage for uploaded images
│   ├── outputs/                    Generated stylized results
│   └── style_images/               6 preset masterworks
│       ├── starry_night.jpg        Van Gogh (1889)
│       ├── the_scream.jpg          Edvard Munch (1893)
│       ├── kandinsky.jpg           Wassily Kandinsky (1923)
│       ├── mosaic.jpg              Byzantine (6th century)
│       ├── wave.jpg                Katsushika Hokusai (1831)
│       └── udnie.jpg               Francis Picabia (1913)
│
├── ⚛️  frontend/                    React 18 · Vite · TailwindCSS
│   └── src/
│       ├── App.jsx                 State machine: idle→processing→done
│       ├── components/
│       │   ├── UploadPanel.jsx     Drag-and-drop with live preview
│       │   ├── StyleGallery.jsx    Art style preset picker
│       │   └── ResultViewer.jsx    Progress bar + download
│       ├── hooks/
│       │   └── useJobPoller.js     Polls /status every 3s (custom hook)
│       └── utils/
│           └── api.js              All API calls in one place
│
├── 📓 notebook/
│   └── nst_colab.ipynb             Colab-ready · free T4 GPU · visualizations
│
├── 🤗 spaces/
│   └── app.py                      Gradio UI for Hugging Face Spaces
│
├── ⚙️  .github/workflows/
│   └── ci.yml                      Test → Build → Deploy on every push
│
├── .gitignore
├── LICENSE                         MIT
└── README.md                       ← you are here
```

---

## 🚀 Quick Start

### ☁️ Option 1 — No Setup (Recommended)

| Platform | Link | GPU? | Cost |
|----------|------|------|------|
| 🌐 Vercel (React App) | [Live App →](https://neural-style-transfer-pied.vercel.app) | CPU | Free forever |
| 📡 Render (FastAPI) | [API Docs →](https://neural-style-transfer-api.onrender.com/docs) | CPU | Free forever |
| 🤗 Hugging Face Spaces | [Gradio App →](https://huggingface.co/spaces/Tusharz/Neural-Style-Transfer) | CPU | Free forever |
| 📓 Google Colab | [Open Notebook →](https://colab.research.google.com/github/TUSHARTAMRAKAR/Neural-Style-Transfer/blob/main/notebook/nst_colab.ipynb) | T4 GPU ✅ | Free |

### 💻 Option 2 — Run Locally

**Prerequisites:** Python 3.10+ · Node.js 18+ · Git

```bash
# 1. Clone
git clone https://github.com/TUSHARTAMRAKAR/neural-style-transfer.git
cd neural-style-transfer

# 2. Backend — Terminal 1
cd backend
python -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
python download_styles.py    # downloads 6 artwork images automatically
uvicorn main:app --reload --port 8000

# 3. Frontend — Terminal 2 (new terminal)
cd frontend
npm install --legacy-peer-deps
npm run dev
```

**Open:** `http://localhost:5173` → web app &nbsp;|&nbsp; `http://localhost:8000/docs` → API playground

---

## 📡 API Reference

Interactive docs auto-generated at `http://localhost:8000/docs`

```
GET  /           → health check
GET  /styles     → list 6 preset artworks
POST /stylize    → submit job (returns job_id instantly)
GET  /status/:id → poll progress (0.0 → 1.0)
GET  /result/:id → download stylized PNG
DEL  /job/:id    → cleanup files
```

### Example — Full Flow

```bash
# Submit a style transfer job
curl -X POST http://localhost:8000/stylize \
  -F "content_image=@my_photo.jpg" \
  -F "preset=starry_night" \
  -F "num_steps=400"
# → { "job_id": "f3a2b1c4-...", "status": "pending" }

# Poll until complete
curl http://localhost:8000/status/f3a2b1c4-...
# → { "status": "processing", "progress": 0.62, "step": 248 }

# Download result
curl http://localhost:8000/result/f3a2b1c4-... --output result.png
```

---

## 🎨 Style Presets & Recommended Settings

| Preset | Artist | Year | Best For | Style Weight |
|--------|--------|------|----------|-------------|
| `starry_night` | Vincent van Gogh | 1889 | Portraits, landscapes | 1e9 |
| `the_scream` | Edvard Munch | 1893 | Portraits | 8e8 |
| `kandinsky` | Wassily Kandinsky | 1923 | Abstract, objects | 1.5e9 |
| `mosaic` | Byzantine | 6th c. | Architecture, scenes | 1.2e9 |
| `wave` | Katsushika Hokusai | 1831 | Landscapes, water | 9e8 |
| `udnie` | Francis Picabia | 1913 | Portraits, abstract | 1e9 |

### Subject Mode Cheat Sheet

```
🧑 Portrait mode    → Steps: 300 · Style: 80M  · Content: 15K  (face preserved)
🌄 Landscape mode   → Steps: 400 · Style: 400M · Content: 5K   (bold transformation)
🎨 Max Style mode   → Steps: 400 · Style: 900M · Content: 1K   (full artistic effect)
```

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **AI Core** | PyTorch | 2.2 | Tensor ops, autograd, VGG-19 |
| **Model** | VGG-19 (ImageNet) | pretrained | Feature extraction |
| **Backend** | FastAPI | 0.110 | Async REST API, auto-docs |
| **Server** | Uvicorn | 0.27 | ASGI server |
| **Frontend** | React | 18 | Component-based UI |
| **Build** | Vite | 5.4 | Lightning-fast dev server |
| **Styling** | TailwindCSS | 3.4 | Utility-first CSS |
| **Notebook** | Jupyter + Colab | — | GPU-accelerated walkthroughs |
| **ML Hosting** | Hugging Face Spaces | — | Free permanent deployment |
| **CI/CD** | GitHub Actions | — | Auto-test + auto-deploy |

</div>

---

## 🔬 Key Technical Decisions

<details>
<summary><b>Why VGG-19 over newer models?</b></summary>

VGG-19's simple sequential architecture makes it ideal for NST — we need clean intermediate feature maps at specific layers without skip connections or attention mechanisms complicating the gradient flow. Its conv layers produce rich, hierarchical feature representations that perfectly separate content from style.

</details>

<details>
<summary><b>Why L-BFGS over Adam for optimization?</b></summary>

NST is an unusually small optimization problem — we're adjusting ~786K pixels (512×512×3) rather than millions of parameters. L-BFGS's quasi-Newton approach with line search converges in ~400 steps vs ~2000 for Adam. The `strong_wolfe` line search condition ensures stable convergence without learning rate tuning.

</details>

<details>
<summary><b>Why FastAPI over Flask?</b></summary>

Style transfer is slow (3–5 min CPU). FastAPI's async `BackgroundTasks` lets us return a `job_id` immediately and run NST in a thread — the client polls `/status/{id}`. Flask's synchronous model would block the entire server. FastAPI also generates `/docs` automatically — no Postman needed.

</details>

<details>
<summary><b>Why Gram matrices capture style but not content?</b></summary>

A Gram matrix `G = F·Fᵀ` computes correlations between feature channels. It tells us "which texture patterns co-occur" but discards ALL spatial information (position, layout). Two images with completely different compositions but the same artistic texture will have nearly identical Gram matrices — that's precisely what we want for style transfer.

</details>

---

## 📊 Performance

| Hardware | Image Size | Steps | Time |
|----------|-----------|-------|------|
| CPU (Intel i7) | 256×256 | 400 | ~5 min |
| CPU (Intel i7) | 384×384 | 400 | ~8 min |
| GPU (T4 Colab) | 512×512 | 400 | ~35 sec |
| GPU (RTX 3080) | 512×512 | 400 | ~15 sec |

---

## 🌐 Deployment

### Hugging Face Spaces (Recommended)

```bash
# 1. Create space at huggingface.co/new-space (SDK: Gradio)
# 2. Add HF_TOKEN to GitHub secrets
# 3. Push to main — CI/CD deploys automatically

git push origin main  # → GitHub Actions → Hugging Face Spaces
```

### Manual Push to HF

```bash
git remote add hf https://huggingface.co/spaces/Tusharz/Neural-Style-Transfer
git push hf main
```

---

## 🤝 Contributing

Contributions are welcome! Here's how:

```bash
# Fork → Clone → Branch → Code → Test → PR
git checkout -b feature/your-amazing-feature
git commit -m "feat: add your amazing feature"
git push origin feature/your-amazing-feature
# Open a Pull Request on GitHub
```

**Ideas for contributions:**
- Fast Neural Style Transfer (feed-forward network — 100x faster!)
- WebSocket real-time progress instead of polling
- Before/after comparison slider in UI
- Additional style presets

---

## 📚 References & Further Reading

| Resource | Link |
|----------|------|
| Original NST paper (Gatys et al., 2015) | [arxiv.org/abs/1508.06576](https://arxiv.org/abs/1508.06576) |
| VGG paper (Simonyan & Zisserman, 2014) | [arxiv.org/abs/1409.1556](https://arxiv.org/abs/1409.1556) |
| Fast NST (Johnson, 2016) | [arxiv.org/abs/1603.08155](https://arxiv.org/abs/1603.08155) |
| PyTorch official NST tutorial | [pytorch.org/tutorials](https://pytorch.org/tutorials/advanced/neural_style_tutorial.html) |
| FastAPI docs | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) |

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

**Built with passion using PyTorch · FastAPI · React · Hugging Face**

<br/>

*If this project helped you, please consider giving it a ⭐ — it means a lot!*

<br/>

[![Star History Chart](https://api.star-history.com/svg?repos=TUSHARTAMRAKAR/neural-style-transfer&type=Date)](https://star-history.com/#TUSHARTAMRAKAR/neural-style-transfer&Date)

</div>
