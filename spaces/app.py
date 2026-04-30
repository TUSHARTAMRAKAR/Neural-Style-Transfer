"""
spaces/app.py — Hugging Face Spaces Entry Point
================================================
Live URL: https://huggingface.co/spaces/Tusharz/Neural-Style-Transfer

Key design: Style images are downloaded at startup from Wikipedia
(public domain) so we don't need to store large files in the repo.
"""

import sys
import os
import uuid
import time
import urllib.request
from pathlib import Path

# ── Add backend to Python path ──────────────────────────────
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import gradio as gr
from nst_engine import run_style_transfer, STYLE_PRESETS

# ── Directories ──────────────────────────────────────────────
OUTPUT_DIR = Path("/tmp/nst_outputs")
STYLES_DIR = Path("/tmp/nst_styles")      # Download here at runtime
OUTPUT_DIR.mkdir(exist_ok=True)
STYLES_DIR.mkdir(exist_ok=True)

# ── Public domain image URLs (Wikipedia — no copyright issues) ──
STYLE_URLS = {
    "starry_night.jpg": (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/"
        "Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/"
        "1280px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg"
    ),
    "the_scream.jpg": (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/"
        "Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard"
        "%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg/"
        "800px-Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard"
        "%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg"
    ),
    "kandinsky.jpg": (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/"
        "Vassily_Kandinsky%2C_1923_-_Composition_8%2C_huile_sur_toile%2C_140_cm_x_201_cm"
        "%2C_Mus%C3%A9e_Guggenheim%2C_New_York.jpg/"
        "1280px-Vassily_Kandinsky%2C_1923_-_Composition_8%2C_huile_sur_toile%2C_140_cm_x_201_cm"
        "%2C_Mus%C3%A9e_Guggenheim%2C_New_York.jpg"
    ),
    "mosaic.jpg": (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/"
        "Meister_von_San_Vitale_in_Ravenna.jpg/"
        "1024px-Meister_von_San_Vitale_in_Ravenna.jpg"
    ),
    "wave.jpg": (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/"
        "Tsunami_by_hokusai_19th_century.jpg/"
        "1280px-Tsunami_by_hokusai_19th_century.jpg"
    ),
    "udnie.jpg": (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/"
        "Francis_Picabia%2C_1913%2C_Udnie_%28Young_American_Girl%2C_The_Dance%29"
        "%2C_oil_on_canvas%2C_290_x_300_cm%2C_Mus%C3%A9e_National_d%27Art_Moderne"
        "%2C_Centre_Georges_Pompidou%2C_Paris.jpg/"
        "800px-Francis_Picabia%2C_1913%2C_Udnie_%28Young_American_Girl%2C_The_Dance%29"
        "%2C_oil_on_canvas%2C_290_x_300_cm%2C_Mus%C3%A9e_National_d%27Art_Moderne"
        "%2C_Centre_Georges_Pompidou%2C_Paris.jpg"
    ),
}


def download_style_images():
    """Download all style images at Space startup if not already present."""
    headers = {"User-Agent": "Mozilla/5.0"}
    print("\n" + "="*50)
    print("Downloading style images...")
    print("="*50)
    for filename, url in STYLE_URLS.items():
        dest = STYLES_DIR / filename
        if dest.exists():
            print(f"  ✓ Already exists: {filename}")
            continue
        try:
            print(f"  ⬇  {filename}...", end=" ", flush=True)
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                with open(dest, "wb") as f:
                    f.write(resp.read())
            size_kb = dest.stat().st_size // 1024
            print(f"✅ ({size_kb}KB)")
        except Exception as e:
            print(f"❌ Failed: {e}")
    print("="*50 + "\n")


# ── Download on startup ───────────────────────────────────────
download_style_images()


# ── Preset choices for dropdown ───────────────────────────────
PRESET_CHOICES = ["None — upload your own style image"] + [
    f"{v['name']} — {v['artist']}" for v in STYLE_PRESETS.values()
]
PRESET_KEY_MAP = {
    f"{v['name']} — {v['artist']}": k for k, v in STYLE_PRESETS.items()
}


# ═══════════════════════════════════════════════════════════
# Core stylize function
# ═══════════════════════════════════════════════════════════

def stylize(
    content_image, style_image, preset_choice, subject_mode,
    num_steps, style_strength, content_preservation,
    progress=gr.Progress(track_tqdm=True),
):
    if content_image is None:
        raise gr.Error("Please upload a content image (your photo).")

    using_preset = preset_choice != "None — upload your own style image"
    if not using_preset and style_image is None:
        raise gr.Error("Please pick a preset style OR upload a custom style image.")

    # ── Resolve style path ────────────────────────────────────
    if using_preset:
        preset_key = PRESET_KEY_MAP[preset_choice]
        preset_cfg = STYLE_PRESETS[preset_key]
        style_path = str(STYLES_DIR / preset_cfg["filename"])
        c_weight   = preset_cfg["content_weight"]
        s_weight   = preset_cfg["style_weight"]
        steps      = preset_cfg["num_steps"]
        if not Path(style_path).exists():
            raise gr.Error(
                f"Style image '{preset_cfg['filename']}' failed to download. "
                f"Please try again or upload a custom style image."
            )
    else:
        style_path = style_image
        c_weight   = content_preservation
        s_weight   = style_strength
        steps      = int(num_steps)

    # ── Apply subject mode ────────────────────────────────────
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

    # ── Run NST ──────────────────────────────────────────────
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


# ═══════════════════════════════════════════════════════════
# Gradio UI
# ═══════════════════════════════════════════════════════════

with gr.Blocks(
    title="Neural Style Transfer",
    theme=gr.themes.Soft(
        primary_hue="indigo", secondary_hue="purple",
        font=gr.themes.GoogleFont("Inter"),
    ),
    css="""
        .gradio-container{max-width:1000px!important;margin:auto!important}
        footer{display:none!important}
    """,
) as demo:

    gr.HTML("""
    <div style="text-align:center;padding:24px 0 12px">
      <h1 style="font-size:2.4rem;font-weight:800;margin:0;
                 background:linear-gradient(135deg,#6366f1,#a855f7);
                 -webkit-background-clip:text;-webkit-text-fill-color:transparent">
        🎨 Neural Style Transfer
      </h1>
      <p style="color:#6b7280;margin-top:10px;font-size:1rem;font-weight:400">
        Transform your photos into masterpieces using VGG-19 deep learning
      </p>
      <div style="margin-top:10px;display:flex;justify-content:center;gap:16px;flex-wrap:wrap">
        <a href="https://arxiv.org/abs/1508.06576" target="_blank"
           style="color:#6366f1;font-size:0.8rem;text-decoration:none">
          📄 Gatys et al., 2015
        </a>
        <a href="https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer" target="_blank"
           style="color:#6366f1;font-size:0.8rem;text-decoration:none">
          ⭐ GitHub
        </a>
        <a href="https://colab.research.google.com/github/TUSHARTAMRAKAR/neural-style-transfer/blob/main/notebook/nst_colab.ipynb"
           target="_blank" style="color:#6366f1;font-size:0.8rem;text-decoration:none">
          📓 Colab (GPU)
        </a>
      </div>
    </div>
    """)

    with gr.Row():
        with gr.Column(scale=1):
            gr.Markdown("### 📸 Upload Images")
            content_img = gr.Image(
                label="Content image — your photo",
                type="filepath", height=260,
            )
            style_img = gr.Image(
                label="Custom style image (optional — use preset instead)",
                type="filepath", height=200,
            )
            gr.Markdown("### 🎨 Art Style")
            preset = gr.Dropdown(
                choices=PRESET_CHOICES,
                value=PRESET_CHOICES[1],
                label="Preset artwork",
                info="Or upload your own style image above",
            )
            gr.Markdown("### 🎯 Subject Mode")
            subject_mode = gr.Radio(
                choices=[
                    "Portrait — preserve face structure",
                    "Landscape — bold transformation",
                    "Max Style — full artistic effect",
                ],
                value="Portrait — preserve face structure",
                label="What type of photo are you stylizing?",
            )

        with gr.Column(scale=1):
            gr.Markdown("### ✨ Stylized Result")
            output_img = gr.Image(
                label="Output",
                type="filepath",
                height=380,
                show_download_button=True,
            )
            stylize_btn = gr.Button(
                "🎨  Stylize my image!",
                variant="primary",
                size="lg",
            )
            with gr.Accordion("⚙️ Advanced settings", open=False):
                gr.Markdown("*Subject mode sets these automatically.*")
                num_steps  = gr.Slider(50,  500,           value=300,        step=50,        label="Quality steps (more = better, slower)")
                s_strength = gr.Slider(10e6, 1_000_000_000, value=80_000_000, step=10_000_000, label="Style strength")
                c_preserve = gr.Slider(500,  50_000,        value=15_000,     step=500,        label="Content preservation")

    with gr.Accordion("🧠 How does this work?", open=False):
        gr.Markdown("""
**Neural Style Transfer** separates and recombines the *content* of one image with the *style* of another.

| Step | What happens |
|------|-------------|
| **1** | VGG-19 extracts **content features** from your photo at layer `conv4_2` |
| **2** | **Gram matrices** capture style texture statistics from the artwork (5 layers) |
| **3** | **L-BFGS optimizer** adjusts canvas pixels to minimize `α×content_loss + β×style_loss` |
| **4** | After ~300-400 iterations → your photo is painted in the artwork's style |

**Key insight:** Gram matrices capture texture *independent of position* — same matrix = same style, any layout.

> Based on [Gatys, Ecker & Bethge (2015)](https://arxiv.org/abs/1508.06576)
        """)

    gr.Markdown("""
### 💡 Tips for best results
- **Portrait photos** → use **Portrait mode** (preserves face, adds artistic texture)
- **Landscapes/scenes** → use **Landscape mode** (bold dramatic transformation)
- **Quick preview** → set steps to **100** (~1-2 min on CPU)
- **Best quality** → set steps to **400** (~8-12 min on CPU)
- **For GPU speed** → use the [Google Colab notebook](https://colab.research.google.com/github/TUSHARTAMRAKAR/neural-style-transfer/blob/main/notebook/nst_colab.ipynb) 🚀
    """)

    gr.HTML("""
    <div style="text-align:center;padding:20px 0;border-top:1px solid #e5e7eb;margin-top:24px">
      <p style="color:#9ca3af;font-size:0.85rem;margin:0">
        Made with ❤️ by
        <a href="https://github.com/TUSHARTAMRAKAR" target="_blank"
           style="color:#6366f1;font-weight:600;text-decoration:none">
          Tushar Tamrakar
        </a>
        &nbsp;·&nbsp;
        <a href="https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer"
           target="_blank" style="color:#6366f1;text-decoration:none">
          ⭐ Star on GitHub
        </a>
        &nbsp;·&nbsp; MIT License
      </p>
    </div>
    """)

    stylize_btn.click(
        fn=stylize,
        inputs=[content_img, style_img, preset, subject_mode, num_steps, s_strength, c_preserve],
        outputs=output_img,
    )

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, share=False, show_error=True)
