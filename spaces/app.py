"""
spaces/app.py — Hugging Face Spaces Entry Point
Live URL: https://huggingface.co/spaces/Tusharz/Neural-Style-Transfer
"""

import sys
import uuid
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import gradio as gr
from nst_engine import run_style_transfer, STYLE_PRESETS

OUTPUT_DIR = Path("/tmp/nst_outputs")
STYLES_DIR = Path("/tmp/nst_styles")
OUTPUT_DIR.mkdir(exist_ok=True)
STYLES_DIR.mkdir(exist_ok=True)

# ── Hosted on GitHub raw — 100% reliable, no rate limits ─────
GITHUB_RAW = "https://raw.githubusercontent.com/TUSHARTAMRAKAR/Neural-Style-Transfer/main/docs/style_images"

STYLE_URLS = {
    "starry_night.jpg": f"{GITHUB_RAW}/starry_night.jpg",
    "the_scream.jpg":   f"{GITHUB_RAW}/the_scream.jpg",
    "kandinsky.jpg":    f"{GITHUB_RAW}/kandinsky.jpg",
    "mosaic.jpg":       f"{GITHUB_RAW}/mosaic.jpg",
    "wave.jpg":         f"{GITHUB_RAW}/wave.jpg",
    "udnie.jpg":        f"{GITHUB_RAW}/udnie.jpg",
}

def download_style_images():
    headers = {"User-Agent": "Mozilla/5.0"}
    print("\n" + "="*50)
    print("Downloading style images from GitHub...")
    print("="*50)
    for filename, url in STYLE_URLS.items():
        dest = STYLES_DIR / filename
        if dest.exists() and dest.stat().st_size > 10000:
            print(f"  ✓ {filename} cached")
            continue
        try:
            print(f"  ⬇  {filename}...", end=" ", flush=True)
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            with open(dest, "wb") as f:
                f.write(data)
            print(f"✅ ({dest.stat().st_size//1024}KB)")
        except Exception as e:
            print(f"❌ {e}")
    print("="*50 + "\n")

download_style_images()

PRESET_CHOICES = ["None — upload your own style image"] + [
    f"{v['name']} — {v['artist']}" for v in STYLE_PRESETS.values()
]
PRESET_KEY_MAP = {
    f"{v['name']} — {v['artist']}": k for k, v in STYLE_PRESETS.items()
}

def stylize(content_image, style_image, preset_choice, subject_mode,
            num_steps, style_strength, content_preservation,
            progress=gr.Progress()):
    if content_image is None:
        raise gr.Error("Please upload a content image (your photo).")
    using_preset = preset_choice != "None — upload your own style image"
    if not using_preset and style_image is None:
        raise gr.Error("Please pick a preset style OR upload a custom style image.")

    if using_preset:
        preset_key = PRESET_KEY_MAP[preset_choice]
        preset_cfg = STYLE_PRESETS[preset_key]
        style_path = str(STYLES_DIR / preset_cfg["filename"])
        c_weight   = preset_cfg["content_weight"]
        s_weight   = preset_cfg["style_weight"]
        steps      = preset_cfg["num_steps"]
        if not Path(style_path).exists():
            raise gr.Error(f"Style image not available. Please upload a custom style image instead.")
    else:
        style_path = style_image
        c_weight   = content_preservation
        s_weight   = style_strength
        steps      = int(num_steps)

    mode_configs = {
        "Portrait":  {"content_weight": 15000,  "style_weight": 80_000_000,  "num_steps": 300},
        "Landscape": {"content_weight": 5000,   "style_weight": 400_000_000, "num_steps": 400},
        "Max Style": {"content_weight": 1000,   "style_weight": 900_000_000, "num_steps": 400},
    }
    for key, cfg in mode_configs.items():
        if key in subject_mode:
            c_weight = cfg["content_weight"]
            s_weight = cfg["style_weight"]
            steps    = cfg["num_steps"]
            break

    job_id      = str(uuid.uuid4())[:8]
    output_path = str(OUTPUT_DIR / f"{job_id}_result.png")

    def progress_cb(step, total, **kwargs):
        progress(step / total, desc=f"Painting... step {step}/{total}")

    progress(0, desc="Loading VGG-19 model...")
    start  = time.time()
    result = run_style_transfer(
        content_path=content_image, style_path=style_path,
        output_path=output_path, num_steps=steps,
        content_weight=c_weight, style_weight=s_weight,
        progress_callback=progress_cb,
    )
    elapsed = time.time() - start
    progress(1.0, desc=f"Done in {elapsed:.0f}s!")
    return result


CSS = """
body { background: #0f0a1e !important; }
.gradio-container {
    max-width: 1050px !important;
    margin: auto !important;
    background: #0f0a1e !important;
    font-family: 'Inter', system-ui, sans-serif !important;
}
.gr-button-primary {
    background: linear-gradient(135deg, #6366f1, #a855f7) !important;
    border: none !important;
    font-size: 1rem !important;
    font-weight: 600 !important;
    padding: 14px !important;
    border-radius: 12px !important;
}
.gr-button-primary:hover { opacity: 0.9 !important; transform: scale(1.01) !important; }
footer { display: none !important; }
.gradio-container h3 { color: #c4b5fd !important; }
"""

with gr.Blocks(title="Neural Style Transfer 🎨", css=CSS) as demo:

    gr.HTML("""
    <div style="text-align:center;padding:28px 0 16px">
      <h1 style="font-size:2.6rem;font-weight:800;margin:0;letter-spacing:-0.5px;
                 background:linear-gradient(135deg,#6366f1,#a855f7);
                 -webkit-background-clip:text;-webkit-text-fill-color:transparent">
        🎨 Neural Style Transfer
      </h1>
      <p style="color:#9ca3af;margin-top:10px;font-size:1rem;font-weight:400">
        Transform your photos into masterpieces using VGG-19 deep learning
      </p>
      <div style="margin-top:12px;display:flex;justify-content:center;gap:20px;flex-wrap:wrap">
        <a href="https://arxiv.org/abs/1508.06576" target="_blank"
           style="color:#818cf8;font-size:0.85rem;text-decoration:none;
                  background:#1e1b4b;padding:4px 12px;border-radius:20px;border:1px solid #3730a3">
          📄 Gatys et al., 2015
        </a>
        <a href="https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer" target="_blank"
           style="color:#818cf8;font-size:0.85rem;text-decoration:none;
                  background:#1e1b4b;padding:4px 12px;border-radius:20px;border:1px solid #3730a3">
          ⭐ GitHub
        </a>
        <a href="https://colab.research.google.com/github/TUSHARTAMRAKAR/neural-style-transfer/blob/main/notebook/nst_colab.ipynb"
           target="_blank"
           style="color:#818cf8;font-size:0.85rem;text-decoration:none;
                  background:#1e1b4b;padding:4px 12px;border-radius:20px;border:1px solid #3730a3">
          📓 Colab GPU
        </a>
      </div>
    </div>
    <hr style="border:none;border-top:1px solid #1e1b4b;margin:0 0 8px"/>
    """)

    with gr.Row(equal_height=False):
        with gr.Column(scale=1):
            gr.Markdown("### 📸 Your Photo")
            content_img = gr.Image(label="Content image", type="filepath", height=240)

            gr.Markdown("### 🎨 Art Style")
            preset = gr.Dropdown(
                choices=PRESET_CHOICES,
                value=PRESET_CHOICES[1],
                label="Choose a preset artwork",
                info="Or upload your own style image below",
            )
            style_img = gr.Image(label="Custom style image (optional)", type="filepath", height=160)

            gr.Markdown("### 🎯 Subject Mode")
            subject_mode = gr.Radio(
                choices=[
                    "Portrait — preserve face structure",
                    "Landscape — bold transformation",
                    "Max Style — full artistic effect",
                ],
                value="Portrait — preserve face structure",
                label="What type of photo?",
            )

        with gr.Column(scale=1):
            gr.Markdown("### ✨ Stylized Result")
            output_img  = gr.Image(label="Output", type="filepath", height=400)
            stylize_btn = gr.Button("🎨  Stylize my image!", variant="primary", size="lg")

            gr.HTML("<br/>")

            with gr.Accordion("⚙️ Advanced settings", open=False):
                gr.Markdown("*Subject mode sets these automatically — tweak if you want.*")
                num_steps  = gr.Slider(50, 500,            value=300,        step=50,         label="Quality steps (more = better, slower)")
                s_strength = gr.Slider(1e7, 1_000_000_000, value=80_000_000, step=10_000_000, label="Style strength")
                c_preserve = gr.Slider(500, 50_000,        value=15_000,     step=500,         label="Content preservation")

    with gr.Accordion("🧠 How does Neural Style Transfer work?", open=False):
        gr.Markdown("""
**NST** uses a pretrained **VGG-19** CNN to separate and recombine image content and style:

| Step | What happens |
|------|-------------|
| **1** | Extract **content features** from your photo at VGG layer `conv4_2` |
| **2** | Extract **style** via **Gram matrices** across 5 layers (captures texture, not position) |
| **3** | **L-BFGS optimizer** minimizes `α × content_loss + β × style_loss` on pixel values |
| **4** | After 300–400 iterations → your photo painted in the artwork's style ✨ |

> Based on [Gatys, Ecker & Bethge — "A Neural Algorithm of Artistic Style" (2015)](https://arxiv.org/abs/1508.06576)
        """)

    gr.Markdown("""
### 💡 Tips for best results
- **Portrait photos** → **Portrait mode** preserves face structure while adding artistic texture
- **Landscapes** → **Landscape mode** gives bold, dramatic transformation
- **Quick preview** → set steps to **100** (~1 min on CPU)
- **Best quality** → set steps to **400** (~8-12 min on CPU)
- **Want GPU speed?** → [Open in Google Colab](https://colab.research.google.com/github/TUSHARTAMRAKAR/neural-style-transfer/blob/main/notebook/nst_colab.ipynb) 🚀
    """)

    gr.HTML("""
    <hr style="border:none;border-top:1px solid #1e1b4b;margin:24px 0 16px"/>
    <div style="text-align:center;padding:8px 0 16px">
      <p style="color:#6b7280;font-size:0.85rem;margin:0">
        Made with <span style="color:#ef4444">❤️</span> by
        <a href="https://github.com/TUSHARTAMRAKAR" target="_blank"
           style="color:#818cf8;font-weight:600;text-decoration:none">Tushar Tamrakar</a>
        &nbsp;·&nbsp;
        <a href="https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer" target="_blank"
           style="color:#818cf8;text-decoration:none">⭐ Star on GitHub</a>
        &nbsp;·&nbsp;
        <span style="color:#4b5563">MIT License</span>
      </p>
    </div>
    """)

    stylize_btn.click(
        fn=stylize,
        inputs=[content_img, style_img, preset, subject_mode, num_steps, s_strength, c_preserve],
        outputs=output_img,
    )

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, show_error=True, ssr_mode=False)
