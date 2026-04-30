"""
spaces/app.py — Hugging Face Spaces Entry Point
================================================
HF Spaces runs this file. It wraps our FastAPI app with a Gradio UI
as the primary interface, and mounts our FastAPI app at /api for the
React frontend (served as static files).

Deployment: Push this repo to a HF Space with SDK: gradio
"""

import os
import sys
import gradio as gr
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from nst_engine import run_style_transfer, get_style_presets, STYLE_PRESETS

# ─────────────────────────────────────────────
# Directories
# ─────────────────────────────────────────────
OUTPUT_DIR = Path("/tmp/nst_outputs")
OUTPUT_DIR.mkdir(exist_ok=True)

STYLES_DIR = Path(__file__).parent.parent / "backend" / "style_images"


# ─────────────────────────────────────────────
# Gradio UI function
# ─────────────────────────────────────────────
def stylize(
    content_image,
    style_image,
    preset_choice,
    num_steps,
    content_weight,
    style_weight,
    progress=gr.Progress(),
):
    """
    Main Gradio function called when user clicks 'Stylize'.
    Gradio handles file I/O and progress display automatically.
    """
    import uuid

    if content_image is None:
        raise gr.Error("Please upload a content image.")

    if style_image is None and preset_choice == "None":
        raise gr.Error("Please upload a style image or pick a preset.")

    job_id     = str(uuid.uuid4())[:8]
    output_path = str(OUTPUT_DIR / f"{job_id}_result.png")

    # Determine style path
    if preset_choice != "None":
        preset_key = preset_choice.lower().replace(" ", "_")
        # Find matching preset
        matching = [k for k, v in STYLE_PRESETS.items() if v["name"] == preset_choice]
        if matching:
            style_path = str(STYLES_DIR / STYLE_PRESETS[matching[0]]["filename"])
        else:
            raise gr.Error(f"Preset '{preset_choice}' not found.")
    else:
        style_path = style_image

    def progress_cb(step, total, **kwargs):
        progress(step / total, desc=f"Step {step}/{total}")

    result_path = run_style_transfer(
        content_path=content_image,
        style_path=style_path,
        output_path=output_path,
        num_steps=int(num_steps),
        content_weight=float(content_weight),
        style_weight=float(style_weight),
        progress_callback=progress_cb,
    )

    return result_path


# ─────────────────────────────────────────────
# Build the Gradio interface
# ─────────────────────────────────────────────
preset_names = ["None"] + [v["name"] for v in STYLE_PRESETS.values()]

with gr.Blocks(
    title="Neural Style Transfer",
    theme=gr.themes.Soft(primary_hue="indigo"),
    css=".gradio-container { max-width: 900px !important; }",
) as demo:
    gr.Markdown("""
    # 🎨 Neural Style Transfer
    **Apply the style of any artwork to your photographs using deep learning.**
    
    Upload your photo + an artwork (or pick a preset), then click **Stylize**!
    
    *Powered by VGG-19 + PyTorch · [GitHub](https://github.com/TUSHARTAMRAKAR/neural-style-transfer) · 
    [Open in Colab](https://colab.research.google.com/github/TUSHARTAMRAKAR/neural-style-transfer/blob/main/notebook/nst_colab.ipynb)*
    """)

    with gr.Row():
        with gr.Column():
            content_img = gr.Image(label="Content image (your photo)", type="filepath")
            style_img   = gr.Image(label="Style image (custom artwork)", type="filepath")
            preset      = gr.Dropdown(choices=preset_names, value="None", label="Or pick a preset style")

        with gr.Column():
            output_img = gr.Image(label="Stylized result", type="filepath")
            with gr.Accordion("Advanced settings", open=False):
                steps   = gr.Slider(50, 500, value=300, step=50, label="Steps (more = better quality)")
                c_wt    = gr.Slider(1000, 100000, value=10000, step=1000, label="Content weight")
                s_wt    = gr.Slider(100000, 5000000, value=1000000, step=100000, label="Style weight")

    btn = gr.Button("🎨 Stylize my image!", variant="primary", size="lg")
    btn.click(
        fn=stylize,
        inputs=[content_img, style_img, preset, steps, c_wt, s_wt],
        outputs=output_img,
    )

    gr.Examples(
        examples=[],  # Add example image pairs here after uploading style images
        inputs=[content_img, style_img, preset],
    )

    gr.Markdown("""
    ### How it works
    | Step | What happens |
    |------|-------------|
    | 1 | VGG-19 extracts feature maps from both images |
    | 2 | **Content loss**: MSE between deep feature maps keeps your photo's structure |
    | 3 | **Style loss**: Gram matrix differences capture texture/color patterns |
    | 4 | **L-BFGS optimizer** iteratively adjusts pixels to minimize both losses |
    
    > Based on [Gatys et al., 2015](https://arxiv.org/abs/1508.06576)
    """)


if __name__ == "__main__":
    demo.launch(share=False)
