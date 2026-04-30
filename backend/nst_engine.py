"""
nst_engine.py — Neural Style Transfer Core Engine
===================================================
This is the BRAIN of the project. It implements the Neural Style Transfer
algorithm from the paper:
  "A Neural Algorithm of Artistic Style" — Gatys et al., 2015
  https://arxiv.org/abs/1508.06576

HOW IT WORKS (plain English):
  1. Load a pretrained VGG-19 network (trained on ImageNet — it already
     "knows" what shapes, textures, and patterns look like).
  2. Extract CONTENT features from your photo (deep layers — "what is in
     the image: objects, faces, structure").
  3. Extract STYLE features from the artwork (multiple layers — "how it
     looks: brushstrokes, texture, color patterns") using Gram matrices.
  4. Start with the content image as a canvas.
  5. Iteratively adjust pixel values using L-BFGS optimizer to MINIMIZE:
       Total Loss = (content_weight × content_loss) + (style_weight × style_loss)
  6. The result: your photo with the artwork's style painted onto it.
"""

import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.transforms as transforms
import torchvision.models as models
from PIL import Image
import copy
import logging
import os
from pathlib import Path

# ─────────────────────────────────────────────
# Logging setup
# ─────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Device configuration
# ─────────────────────────────────────────────
# We automatically use GPU if available, fall back to CPU.
# On CPU this takes ~2-5 minutes. On GPU: ~15-30 seconds.
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"NST Engine running on: {DEVICE}")


# ─────────────────────────────────────────────
# Image size config
# ─────────────────────────────────────────────
# Smaller = faster but lower quality. 512 is a good CPU balance.
# On GPU you can push to 1024.
IMAGE_SIZE = 512 if torch.cuda.is_available() else 384  # 384 on CPU = better quality vs speed tradeoff


# ═══════════════════════════════════════════════════════════
# SECTION 1: Image Utilities
# ═══════════════════════════════════════════════════════════

def load_image(image_path: str, size: int = IMAGE_SIZE) -> torch.Tensor:
    """
    Load an image from disk and convert it to a PyTorch tensor.

    Pipeline:
      PIL Image → Resize → ToTensor (values 0-1) → Normalize (ImageNet stats)
      → Add batch dimension [1, C, H, W] → Move to device

    Why normalize with ImageNet stats?
      VGG-19 was trained with these exact normalization values.
      Using the same stats ensures the network "sees" the image correctly.
    """
    # ImageNet normalization values (mean and std per channel)
    imagenet_mean = [0.485, 0.456, 0.406]
    imagenet_std  = [0.229, 0.224, 0.225]

    transform = transforms.Compose([
        transforms.Resize((size, size)),
        transforms.ToTensor(),                        # [0,255] → [0.0, 1.0]
        transforms.Normalize(imagenet_mean, imagenet_std),
    ])

    image = Image.open(image_path).convert("RGB")     # Force 3-channel RGB
    tensor = transform(image).unsqueeze(0)            # Add batch dim: [1,3,H,W]
    return tensor.to(DEVICE)


def tensor_to_image(tensor: torch.Tensor) -> Image.Image:
    """
    Convert an output tensor back to a PIL Image for saving.
    Uses numpy uint8 conversion to guarantee a valid, openable PNG.
    """
    import numpy as np

    imagenet_mean = torch.tensor([0.485, 0.456, 0.406])
    imagenet_std  = torch.tensor([0.229, 0.224, 0.225])

    # Remove batch dim, detach from graph, move to CPU
    image = tensor.clone().squeeze(0).detach().cpu()

    # Reverse normalization: pixel = (normalized * std) + mean
    image = image * imagenet_std[:, None, None] + imagenet_mean[:, None, None]

    # Clamp to [0, 1] then convert to uint8 numpy [H, W, 3]
    image = image.clamp(0, 1)
    arr = (image.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
    return Image.fromarray(arr, mode="RGB")


def save_output_image(tensor: torch.Tensor, output_path: str) -> str:
    """Save the stylized output tensor to disk as a valid PNG file."""
    image = tensor_to_image(tensor)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="PNG")
    size = Path(output_path).stat().st_size
    logger.info(f"Output saved to: {output_path} ({size} bytes)")
    if size < 1000:
        raise RuntimeError(f"Output file too small ({size} bytes) — may be corrupt")
    return output_path


# ═══════════════════════════════════════════════════════════
# SECTION 2: Loss Modules
# ═══════════════════════════════════════════════════════════

class ContentLoss(nn.Module):
    """
    Measures how much the generated image differs from the content image
    in terms of HIGH-LEVEL STRUCTURE (objects, shapes, composition).

    HOW IT WORKS:
      - We pick a deep VGG layer (conv4_2) — deep layers capture
        "what objects are where" rather than pixel colors.
      - We save the content image's feature map at that layer as a TARGET.
      - During optimization, we compute MSE between the current image's
        feature map and the target. This is our content loss.

    WHY MSE?
      We want the feature representations to be similar, not the
      pixels themselves. MSE on features = structural similarity.
    """

    def __init__(self, target_features: torch.Tensor):
        super().__init__()
        # Detach so gradients don't flow back into the target
        self.target = target_features.detach()
        self.loss = torch.tensor(0.0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Mean Squared Error between current and target feature maps
        self.loss = nn.functional.mse_loss(x, self.target)
        return x  # Pass through unchanged (we just measure, don't modify)


class StyleLoss(nn.Module):
    """
    Measures how much the generated image differs from the style image
    in terms of TEXTURE and COLOR PATTERNS (brushstrokes, palette).

    THE KEY INSIGHT — GRAM MATRICES:
      Instead of comparing feature maps directly (which would just copy
      the style image's layout), we compare their GRAM MATRICES.

      A Gram matrix captures CORRELATIONS between feature channels.
      - "When channel 5 fires (vertical strokes), does channel 12 also
        fire (warm colors)?" → This is texture/style, not structure.
      - Same Gram matrix = same texture statistics, regardless of position.

    This is the most elegant part of the NST algorithm.
    """

    def __init__(self, target_features: torch.Tensor):
        super().__init__()
        # Compute and save the style image's Gram matrix as target
        self.target = self._gram_matrix(target_features).detach()
        self.loss = torch.tensor(0.0)

    @staticmethod
    def _gram_matrix(features: torch.Tensor) -> torch.Tensor:
        """
        Compute the Gram matrix of a feature map.

        Given features of shape [batch, channels, height, width]:
          1. Reshape to [channels, height*width]  — flatten spatial dims
          2. Gram = features @ features.T         — channel correlations
          3. Normalize by total elements

        The result captures texture statistics independent of position.
        """
        batch, channels, height, width = features.size()
        # Reshape: each channel becomes a row of all its pixel values
        f = features.view(batch * channels, height * width)
        # Matrix multiply to get channel correlations
        gram = torch.mm(f, f.t())
        # Normalize so loss magnitude doesn't depend on image/layer size
        return gram.div(batch * channels * height * width)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        gram = self._gram_matrix(x)
        self.loss = nn.functional.mse_loss(gram, self.target)
        return x  # Pass through unchanged


# ═══════════════════════════════════════════════════════════
# SECTION 3: VGG-19 Model Setup
# ═══════════════════════════════════════════════════════════

# Which VGG-19 layers to use for content and style.
#
# VGG-19 layer naming (torchvision):
#   conv1_1 = features[0],  relu1_1 = features[1]
#   conv1_2 = features[2],  relu1_2 = features[3], pool1 = features[4]
#   conv2_1 = features[5],  ...etc
#
# CONTENT: conv4_2 (deep layer) — captures high-level structure
# STYLE:   conv1_1, conv2_1, conv3_1, conv4_1, conv5_1
#          (multiple layers = coarse + fine texture detail)
CONTENT_LAYERS_DEFAULT = ["conv4_2"]
STYLE_LAYERS_DEFAULT   = ["conv1_1", "conv2_1", "conv3_1", "conv4_1", "conv5_1"]

# Map readable names → VGG-19 feature layer indices
VGG_LAYER_MAP = {
    "conv1_1":  0, "relu1_1":  1,
    "conv1_2":  2, "relu1_2":  3, "pool1":  4,
    "conv2_1":  5, "relu2_1":  6,
    "conv2_2":  7, "relu2_2":  8, "pool2":  9,
    "conv3_1": 10, "relu3_1": 11,
    "conv3_2": 12, "relu3_2": 13,
    "conv3_3": 14, "relu3_3": 15,
    "conv3_4": 16, "relu3_4": 17, "pool3": 18,
    "conv4_1": 19, "relu4_1": 20,
    "conv4_2": 21, "relu4_2": 22,
    "conv4_3": 23, "relu4_3": 24,
    "conv4_4": 25, "relu4_4": 26, "pool4": 27,
    "conv5_1": 28, "relu5_1": 29,
    "conv5_2": 30, "relu5_2": 31,
    "conv5_3": 32, "relu5_3": 33,
    "conv5_4": 34, "relu5_4": 35, "pool5": 36,
}


def build_model_and_losses(
    vgg: nn.Module,
    content_img: torch.Tensor,
    style_img: torch.Tensor,
    content_layers: list = CONTENT_LAYERS_DEFAULT,
    style_layers: list   = STYLE_LAYERS_DEFAULT,
):
    """
    Build a modified VGG-19 that inserts ContentLoss and StyleLoss
    modules at the right layers.

    Strategy:
      Instead of running two separate forward passes for content and style,
      we INSERT our loss modules directly into the network graph.
      When we do a forward pass, losses are computed automatically at
      the correct intermediate layers.

    Returns:
      model          — modified VGG with loss modules inserted
      content_losses — list of ContentLoss modules (to read .loss from)
      style_losses   — list of StyleLoss modules (to read .loss from)
    """
    # We only need the feature extractor part of VGG (no classifier)
    vgg_features = copy.deepcopy(vgg.features).to(DEVICE).eval()

    # Determine the deepest layer we need
    all_needed = content_layers + style_layers
    max_index = max(VGG_LAYER_MAP[name] for name in all_needed)

    model = nn.Sequential()
    content_losses = []
    style_losses   = []

    # Walk through VGG layers up to max_index
    for i, layer in enumerate(vgg_features):
        if i > max_index:
            break

        # Rename layers for clarity in model.named_children()
        if isinstance(layer, nn.Conv2d):
            # Find readable name for this index
            name = next(k for k, v in VGG_LAYER_MAP.items()
                        if v == i and k.startswith("conv"))
        elif isinstance(layer, nn.ReLU):
            name = next(k for k, v in VGG_LAYER_MAP.items()
                        if v == i and k.startswith("relu"))
            # Use in-place=False to avoid corrupting saved feature maps
            layer = nn.ReLU(inplace=False)
        elif isinstance(layer, nn.MaxPool2d):
            name = next(k for k, v in VGG_LAYER_MAP.items()
                        if v == i and k.startswith("pool"))
            # Replace MaxPool with AvgPool → smoother gradients → better style
            layer = nn.AvgPool2d(kernel_size=2, stride=2)
        else:
            name = f"layer_{i}"

        model.add_module(name, layer)

        # After a content layer: run content image through, save features
        if name in content_layers:
            target = model(content_img)
            cl = ContentLoss(target)
            model.add_module(f"content_loss_{name}", cl)
            content_losses.append(cl)

        # After a style layer: run style image through, compute Gram matrix
        if name in style_layers:
            target = model(style_img)
            sl = StyleLoss(target)
            model.add_module(f"style_loss_{name}", sl)
            style_losses.append(sl)

    return model, content_losses, style_losses


# ═══════════════════════════════════════════════════════════
# SECTION 4: Main Style Transfer Function
# ═══════════════════════════════════════════════════════════

def run_style_transfer(
    content_path: str,
    style_path: str,
    output_path: str,
    num_steps: int       = 400,
    content_weight: float = 1e3,   # lower = less photo-like, more artistic
    style_weight: float   = 1e9,   # MUCH higher = strong visible style effect
    progress_callback=None,
) -> str:
    """
    Run Neural Style Transfer and save the result.

    Args:
      content_path     — path to your photo (the "what")
      style_path       — path to the artwork (the "how it looks")
      output_path      — where to save the result PNG
      num_steps        — optimization iterations (more = better quality,
                         slower; 300 is good for CPU, 500 for GPU)
      content_weight   — how much to preserve photo structure (higher = 
                         more photo-like)
      style_weight     — how much style to apply (higher = more painterly)
      progress_callback — optional fn(step, total, loss) for progress updates

    Returns:
      output_path — path to the saved stylized image

    OPTIMIZATION DETAILS:
      We use L-BFGS (Limited-memory BFGS), a quasi-Newton optimizer.
      Unlike Adam/SGD which update one step at a time, L-BFGS uses
      second-order curvature info to take smarter steps.
      It converges much faster for style transfer (Gatys et al. original).

      The INPUT being optimized is the IMAGE ITSELF (not network weights!).
      We freeze VGG-19 and let gradients flow back into pixel values.
    """
    logger.info("=" * 60)
    logger.info("Starting Neural Style Transfer")
    logger.info(f"  Content: {content_path}")
    logger.info(f"  Style:   {style_path}")
    logger.info(f"  Output:  {output_path}")
    logger.info(f"  Device:  {DEVICE}")
    logger.info(f"  Steps:   {num_steps}")
    logger.info("=" * 60)

    # ── Step 1: Load images ──────────────────────────────
    content_img = load_image(content_path)
    style_img   = load_image(style_path)

    # ── Step 2: Load pretrained VGG-19 ──────────────────
    # weights=DEFAULT downloads from torchvision model zoo if not cached
    logger.info("Loading VGG-19 (downloading if first time ~548MB)...")
    vgg = models.vgg19(weights=models.VGG19_Weights.DEFAULT)

    # Freeze all VGG weights — we only optimize the image
    for param in vgg.parameters():
        param.requires_grad_(False)

    # ── Step 3: Build model with loss modules inserted ───
    model, content_losses, style_losses = build_model_and_losses(
        vgg, content_img, style_img
    )
    model.eval()

    # ── Step 4: Initialize the canvas ───────────────────
    # Start from content image — converges faster than white noise
    # requires_grad=True tells PyTorch to track gradients for this tensor
    input_img = content_img.clone().requires_grad_(True)

    # ── Step 5: Set up L-BFGS optimizer ─────────────────
    # Note: we optimize INPUT_IMG, not model parameters!
    optimizer = optim.LBFGS([input_img], max_iter=20, line_search_fn="strong_wolfe")

    logger.info("Starting optimization loop...")
    step_counter = [0]  # Use list so closure can modify it

    def closure():
        """
        L-BFGS requires a closure (a callable that recomputes loss).
        This is called multiple times per step for line search.
        """
        # Clamp pixel values to valid normalized range
        with torch.no_grad():
            input_img.clamp_(-3.0, 3.0)  # wider range = more style freedom

        optimizer.zero_grad()

        # Forward pass through the model
        # Loss modules compute their losses as side effects
        model(input_img)

        # Sum content losses (weighted)
        c_loss = sum(cl.loss for cl in content_losses) * content_weight

        # Sum style losses across all layers (weighted)
        s_loss = sum(sl.loss for sl in style_losses) * style_weight

        total_loss = c_loss + s_loss
        total_loss.backward()

        step_counter[0] += 1

        # Log progress every 50 steps
        if step_counter[0] % 50 == 0 or step_counter[0] == 1:
            logger.info(
                f"Step {step_counter[0]:3d}/{num_steps} | "
                f"Content loss: {c_loss.item():.4f} | "
                f"Style loss: {s_loss.item():.4f} | "
                f"Total: {total_loss.item():.4f}"
            )
            if progress_callback:
                progress_callback(
                    step=step_counter[0],
                    total=num_steps,
                    content_loss=c_loss.item(),
                    style_loss=s_loss.item(),
                    total_loss=total_loss.item(),
                )

        return total_loss

    # ── Step 6: Run optimization ─────────────────────────
    # Each optimizer.step() internally calls closure() multiple times
    # We loop to reach num_steps total closure evaluations
    while step_counter[0] < num_steps:
        optimizer.step(closure)

    # ── Step 7: Save result ──────────────────────────────
    # Final clamp before saving
    with torch.no_grad():
        input_img.clamp_(-2.5, 2.5)

    output_path = save_output_image(input_img, output_path)
    logger.info("✅ Style transfer complete!")
    return output_path


# ═══════════════════════════════════════════════════════════
# SECTION 5: Preset Style Configurations
# ═══════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────
# TUNED PRESETS — weights calibrated for visible, striking results
#
# Key insight: style_weight must be 1e8 to 1e10 to actually show.
# content_weight 1e3 = more artistic, 1e4 = more photo-like.
# Each artwork has its own ideal balance based on its complexity.
# ─────────────────────────────────────────────────────────────
STYLE_PRESETS = {
    "starry_night": {
        "name":            "Starry Night",
        "artist":          "Vincent van Gogh",
        "description":     "Swirling night sky with bold blues and yellows",
        "content_weight":  1e3,
        "style_weight":    1e9,    # Van Gogh needs very strong style weight
        "num_steps":       400,
        "filename":        "starry_night.jpg",
    },
    "the_scream": {
        "name":            "The Scream",
        "artist":          "Edvard Munch",
        "description":     "Expressive wavy lines with deep oranges and blues",
        "content_weight":  1e3,
        "style_weight":    8e8,
        "num_steps":       400,
        "filename":        "the_scream.jpg",
    },
    "kandinsky": {
        "name":            "Composition VIII",
        "artist":          "Wassily Kandinsky",
        "description":     "Geometric shapes, bold colors, abstract forms",
        "content_weight":  5e2,    # very low content = very abstract result
        "style_weight":    1.5e9,
        "num_steps":       400,
        "filename":        "kandinsky.jpg",
    },
    "mosaic": {
        "name":            "Ancient Mosaic",
        "artist":          "Byzantine",
        "description":     "Tile-like patterns with earthy tones",
        "content_weight":  1e3,
        "style_weight":    1.2e9,
        "num_steps":       400,
        "filename":        "mosaic.jpg",
    },
    "wave": {
        "name":            "The Great Wave",
        "artist":          "Katsushika Hokusai",
        "description":     "Japanese woodblock with dramatic blues and whites",
        "content_weight":  1e3,
        "style_weight":    9e8,
        "num_steps":       400,
        "filename":        "wave.jpg",
    },
    "udnie": {
        "name":            "Udnie",
        "artist":          "Francis Picabia",
        "description":     "Cubist abstract with warm browns and greens",
        "content_weight":  5e2,
        "style_weight":    1e9,
        "num_steps":       400,
        "filename":        "udnie.jpg",
    },
}


def get_style_presets() -> dict:
    """Return all available style presets (for the API /styles endpoint)."""
    return STYLE_PRESETS


def get_preset_config(preset_key: str) -> dict:
    """Get config for a specific preset. Raises ValueError if not found."""
    if preset_key not in STYLE_PRESETS:
        available = list(STYLE_PRESETS.keys())
        raise ValueError(f"Unknown preset '{preset_key}'. Available: {available}")
    return STYLE_PRESETS[preset_key]


# ═══════════════════════════════════════════════════════════
# SECTION 6: Quick Test (run this file directly to verify)
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    """
    Quick smoke test — creates tiny random tensors to verify the
    math pipeline works without needing real images or VGG download.
    """
    import tempfile
    import numpy as np

    print("\n" + "=" * 60)
    print("NST Engine — Smoke Test")
    print("=" * 60)

    # Test 1: Gram matrix
    print("\n[1] Testing Gram matrix computation...")
    dummy = torch.randn(1, 64, 32, 32)
    gram  = StyleLoss._gram_matrix(dummy)
    assert gram.shape == (64, 64), f"Expected (64,64), got {gram.shape}"
    print(f"    ✅ Gram matrix shape correct: {gram.shape}")

    # Test 2: Image round-trip
    print("\n[2] Testing image load/save round-trip...")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        tmp_path = f.name
    dummy_img = Image.fromarray(
        (np.random.rand(64, 64, 3) * 255).astype(np.uint8)
    )
    dummy_img.save(tmp_path)
    loaded = load_image(tmp_path, size=64)
    assert loaded.shape == (1, 3, 64, 64), f"Unexpected shape: {loaded.shape}"
    print(f"    ✅ Loaded tensor shape: {loaded.shape}")
    recovered = tensor_to_image(loaded)
    print(f"    ✅ Recovered PIL image size: {recovered.size}")
    os.unlink(tmp_path)

    # Test 3: Presets
    print("\n[3] Testing style presets...")
    presets = get_style_presets()
    print(f"    ✅ {len(presets)} presets available: {list(presets.keys())}")

    print("\n" + "=" * 60)
    print("✅ All smoke tests passed! NST engine is ready.")
    print(f"   Running on: {DEVICE}")
    print("=" * 60 + "\n")
