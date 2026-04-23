import torch

from generator import Generator
from discriminator import MultiScaleDiscriminator
from losses import FiBGANLossAggregator


def test_fibgan_forward():

    device = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )

    print(f"\nRunning FiBGAN sanity test on {device}\n")

    # =====================================
    # Initialize Models
    # =====================================
    print("Initializing Generator...")
    gen = Generator(style_dim=512).to(device)

    print("Initializing Discriminator...")
    disc = MultiScaleDiscriminator().to(device)

    print("Initializing Loss Aggregator...")
    criterion = FiBGANLossAggregator(device=device)

    gen.train()
    disc.train()

    # =====================================
    # Dummy Data
    # =====================================
    batch_size = 2

    x_fake = torch.randn(
        batch_size, 3, 512, 512,
        device=device
    ).clamp(-1, 1)

    x_real = torch.randn(
        batch_size, 3, 512, 512,
        device=device
    ).clamp(-1, 1)

    intensity = torch.tensor(
        [[0.6], [0.9]],
        device=device
    )

    # =====================================
    # Generator Forward
    # =====================================
    print("\nTesting Generator Forward...")

    with torch.amp.autocast("cuda", enabled=(device.type == "cuda")):
        fake_imgs = gen(x_fake, intensity)

    assert fake_imgs.shape == (
        batch_size, 3, 512, 512
    ), f"Generator output shape mismatch: {fake_imgs.shape}"

    print("Generator forward successful!")

    # =====================================
    # Discriminator Forward
    # =====================================
    print("\nTesting Discriminator Forward...")

    fake_preds = disc(fake_imgs)

    assert isinstance(fake_preds, list), \
        "Discriminator must return list of multi-scale outputs"

    print(f"Discriminator returned {len(fake_preds)} scales")

    for i, pred in enumerate(fake_preds):
        print(f"Scale {i+1} output shape: {pred.shape}")

    # =====================================
    # Generator Loss
    # =====================================
    print("\nTesting Generator Loss...")

    g_loss, loss_dict = criterion.get_g_loss(
        fake_imgs,
        x_real,
        fake_preds
    )

    print(f"G Loss: {g_loss.item():.4f}")
    print(loss_dict)

    # =====================================
    # Discriminator Loss
    # =====================================
    print("\nTesting Discriminator Loss...")

    real_preds = disc(x_real)

    d_loss_total = 0

    for r_pred, f_pred in zip(real_preds, fake_preds):
        d_loss_total += criterion.get_d_loss(
            r_pred,
            f_pred.detach()
        )

    print(f"D Loss: {d_loss_total.item():.4f}")

    # =====================================
    # Backpropagation Test
    # =====================================
    print("\nTesting Backpropagation...")

    gen.zero_grad()
    disc.zero_grad()

    g_loss.backward(retain_graph=True)

    gen_grad_found = any(
        param.grad is not None for param in gen.parameters()
    )

    assert gen_grad_found, \
        "No gradients flowed through generator!"

    print("Generator gradients confirmed!")

    d_loss_total.backward()

    disc_grad_found = any(
        param.grad is not None for param in disc.parameters()
    )

    assert disc_grad_found, \
        "No gradients flowed through discriminator!"

    print("Discriminator gradients confirmed!")

    # =====================================
    # Identity Loss Check
    # =====================================
    if criterion.identity_loss.net is None:

        print("\nWARNING: Identity loss disabled (FaceNet not installed)")

    else:

        print("\nIdentity loss network loaded successfully")

    print("\nFiBGAN pipeline test completed successfully!\n")


if __name__ == "__main__":
    test_fibgan_forward()