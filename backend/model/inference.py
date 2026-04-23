import torch
import argparse
import os
from PIL import Image
from torchvision import transforms

from generator import Generator


# ======================================
# Load Generator
# ======================================
def load_generator(checkpoint_path, device):

    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    gen = Generator(style_dim=512).to(device)

    checkpoint = torch.load(checkpoint_path, map_location=device)

    if "generator_ema" in checkpoint:
        print("Using EMA generator weights")
        gen.load_state_dict(checkpoint["generator_ema"])

    elif "generator" in checkpoint:
        gen.load_state_dict(checkpoint["generator"])

    else:
        gen.load_state_dict(checkpoint)

    gen.eval()

    return gen


# ======================================
# Image Preprocessing
# ======================================
def preprocess_image(img_path, device):

    if not os.path.exists(img_path):
        raise FileNotFoundError(f"Input image not found: {img_path}")

    try:
        img = Image.open(img_path).convert("RGB")
    except Exception:
        raise RuntimeError("Failed to open image. Unsupported or corrupted file.")

    orig_size = img.size

    transform = transforms.Compose([
        transforms.Resize((512, 512)),
        transforms.ToTensor(),
        transforms.Normalize(
            (0.5, 0.5, 0.5),
            (0.5, 0.5, 0.5)
        )
    ])

    x = transform(img).unsqueeze(0).to(device)

    return x, orig_size


# ======================================
# Save Output
# ======================================
def save_image(tensor, output_path, orig_size):

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    tensor = (tensor.squeeze(0) + 1) / 2
    tensor = torch.clamp(tensor, 0, 1)

    img = transforms.ToPILImage()(tensor.cpu())

    img = img.resize(orig_size, Image.LANCZOS)

    img.save(output_path)


# ======================================
# Inference Function
# ======================================
def run_inference(gen, img_tensor, intensity):

    intensity_tensor = torch.tensor([[intensity]], device=img_tensor.device)

    with torch.inference_mode():
        output = gen(img_tensor, intensity=intensity_tensor)

    return output


# ======================================
# Main
# ======================================
if __name__ == "__main__":

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "-i", "--input",
        required=True,
        help="Input image path"
    )

    parser.add_argument(
        "-o", "--output",
        required=True,
        help="Output image path"
    )

    parser.add_argument(
        "-w", "--weights",
        required=True,
        help="Generator checkpoint"
    )

    parser.add_argument(
        "--intensity",
        type=float,
        default=1.0,
        help="Beautification intensity (0.3 - 1.0)"
    )

    args = parser.parse_args()

    device = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )

    print(f"Using device: {device}")

    intensity = max(0.3, min(1.0, args.intensity))

    print(f"Beautification intensity set to {intensity}")

    generator = load_generator(args.weights, device)

    img_tensor, orig_size = preprocess_image(
        args.input,
        device
    )

    print("Running beautification...")

    output = run_inference(
        generator,
        img_tensor,
        intensity
    )

    save_image(
        output,
        args.output,
        orig_size
    )

    print(f"Beautified image saved → {args.output}")
