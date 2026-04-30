"""
spaces/app.py — Hugging Face Spaces Entry Point
================================================
Live URL: https://huggingface.co/spaces/TUSHARTAMRAKAR/neural-style-transfer
"""

import sys
import os
import uuid
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import gradio as gr
from nst_engine import run_style_transfer, STYLE_PRESETS

OUTPUT_DIR = Path("/tmp/nst_outputs")
OUTPUT_DIR.mkdir(exist_ok=True)
STYLES_DIR = Path(__file__).parent.parent / "backend" / "style_images"

PRESET_CHOICES = ["None — upload your own style image"] + [
    f"{v['name']} — {v['artist']}" for v in STYLE_PRESETS.values()
]
PRESET_KEY_MAP = {
    f"{v['name']} — {v['artist']}": k for k, v in STYLE_PRESETS.items()
}

def stylize(content_image, style_image, preset_choice, subject_mode,
            num_steps, style_strength, content_preservation,
            progress=gr.Progress(track_tqdm=True)):

    if content_image is None:
        raise gr.Error("Please upload a content image.")

    using_preset = preset_choice != "None — upload your own style image"
    if not using_preset and style_image is None:
        raise gr.Error("Please pick a preset style or upload a custom style image.")

    if using_preset:
        preset_key  = PRESET_KEY_MAP[preset_choice]
        preset_cfg  = STYLE_PRESETS[preset_key]
        style_path  = str(STYLES_DIR / preset_cfg["filename"])
        c_weight    = preset_cfg["content_weight"]
        s_weight    = preset_cfg["style_weight"]
        steps       = preset_cfg["num_steps"]
        if not Path(style_path).exists():
            raise gr.Error(f"Style image '{preset_cfg['filename']}' not found. Ensure style images are in backend/style_images/")
    else:
        style_path = style_image
        c_weight   = content_preservation
        s_weight   = style_strength
        steps      = int(num_steps)

    mode_configs = {
        "Portrait — preserve face structure":   {"content_weight": 15000,  "style_weight": 80_000_000,  "num_steps": 300},
        "Landscape — bold transformation":      {"content_weight": 5000,   "style_weight": 400_000_000, "num_steps": 400},
        "Max Style — full artistic effect":     {"content_weight": 1000,   "style_weight": 900_000_000, "num_steps": 400},
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

    progress(0, desc="Loading VGG-19...")
    start = time.time()
    result = run_style_transfer(
        content_path=content_image, style_path=style_path,
        output_path=output_path, num_steps=steps,
        content_weight=c_weight, style_weight=s_weight,
        progress_callback=progress_cb,
    )
    elapsed = time.time() - start
    progress(1.0, desc=f"Done in {elapsed:.0f}s!")
    return result

with gr.Blocks(
    title="Neural Style Transfer",
    theme=gr.themes.Soft(primary_hue="indigo", secondary_hue="purple",
                         font=gr.themes.GoogleFont("Inter")),
    css=".gradio-container{max-width:1000px!important;margin:auto!important} footer{display:none!important}",
) as demo:

    gr.HTML("""
    <div style="text-align:center;padding:20px 0 10px">
      <h1 style="font-size:2.2rem;font-weight:800;margin:0;
                 background:linear-gradient(135deg,#6366f1,#a855f7);
                 -webkit-background-clip:text;-webkit-text-fill-color:transparent">
        Neural Style Transfer
      </h1>
      <p style="color:#6b7280;margin-top:8px">
        Transform your photos into masterpieces using VGG-19 deep learning
      </p>
      <p style="color:#9ca3af;font-size:0.8rem;margin-top:4px">
        Based on <a href="https://arxiv.org/abs/1508.06576" target="_blank"
        style="color:#6366f1">Gatys et al., 2015</a> &nbsp;·&nbsp;
        <a href="https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer"
        target="_blank" style="color:#6366f1">GitHub</a>
      </p>
    </div>""")

    with gr.Row():
        with gr.Column(scale=1):
            gr.Markdown("### Your Images")
            content_img = gr.Image(label="Content image (your photo)", type="filepath", height=250)
            style_img   = gr.Image(label="Custom style image (optional)", type="filepath", height=200)
            gr.Markdown("### Choose a Style")
            preset      = gr.Dropdown(choices=PRESET_CHOICES, value=PRESET_CHOICES[1], label="Preset art style")
            gr.Markdown("### Subject Mode")
            subject_mode = gr.Radio(
                choices=["Portrait — preserve face structure",
                         "Landscape — bold transformation",
                         "Max Style — full artistic effect"],
                value="Portrait — preserve face structure",
                label="What type of photo?",
            )
        with gr.Column(scale=1):
            gr.Markdown("### Result")
            output_img = gr.Image(label="Stylized output", type="filepath", height=380, show_download_button=True)
            stylize_btn = gr.Button("🎨  Stylize my image!", variant="primary", size="lg")
            with gr.Accordion("Advanced settings", open=False):
                num_steps   = gr.Slider(50,  500,            value=300,        step=50,        label="Quality steps")
                s_strength  = gr.Slider(10e6, 1_000_000_000, value=80_000_000, step=10_000_000, label="Style strength")
                c_preserve  = gr.Slider(500,  50_000,         value=15_000,     step=500,        label="Content preservation")

    with gr.Accordion("How does this work?", open=False):
        gr.Markdown("""
**Neural Style Transfer** uses a pretrained **VGG-19** CNN to:
1. Extract **content features** from your photo (layer conv4_2 — shape & structure)
2. Extract **style features** from the artwork via **Gram matrices** (texture & color statistics)
3. **Optimize pixel values** using L-BFGS to minimize `α×content_loss + β×style_loss`
4. Result: your photo, painted in the artwork's style

> [Gatys, Ecker & Bethge (2015)](https://arxiv.org/abs/1508.06576)
        """)

    gr.HTML("""
    <div style="text-align:center;padding:16px 0;border-top:1px solid #e5e7eb;margin-top:16px">
      <p style="color:#9ca3af;font-size:0.85rem">
        Made with ❤️ by
        <a href="https://github.com/TUSHARTAMRAKAR" target="_blank"
           style="color:#6366f1;font-weight:600">Tushar Tamrakar</a>
        &nbsp;·&nbsp;
        <a href="https://github.com/TUSHARTAMRAKAR/Neural-Style-Transfer"
           target="_blank" style="color:#6366f1">⭐ Star on GitHub</a>
        &nbsp;·&nbsp; MIT License
      </p>
    </div>""")

    stylize_btn.click(
        fn=stylize,
        inputs=[content_img, style_img, preset, subject_mode, num_steps, s_strength, c_preserve],
        outputs=output_img,
    )

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, share=False, show_error=True)
