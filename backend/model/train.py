import os
import copy
import glob
import re
import random
import numpy as np
import torch
import torch.backends.cudnn as cudnn
from torch.utils.data import DataLoader
from torch.optim import Adam

from dataset import BeautifyDataset
from generator import Generator
from discriminator import MultiScaleDiscriminator
from losses import FiBGANLossAggregator


# ==============================
# Enable TF32 (A100 Optimization)
# ==============================
torch.backends.cuda.matmul.allow_tf32 = True
torch.backends.cudnn.allow_tf32 = True


# ==============================
# Set Random Seed
# ==============================
def set_seed(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


# ==============================
# Load Latest Checkpoint
# ==============================
def load_latest_checkpoint(checkpoints_dir, gen, disc, opt_g, opt_d, device):

    checkpoints = glob.glob(os.path.join(checkpoints_dir, "fibgan_epoch_*.pth"))

    if not checkpoints:
        return 0

    latest = max(checkpoints, key=lambda x: int(re.findall(r'\d+', x)[-1]))

    print(f"Resuming from checkpoint: {latest}")

    checkpoint = torch.load(latest, map_location=device)

    gen.load_state_dict(checkpoint["generator"])
    disc.load_state_dict(checkpoint["discriminator"])

    opt_g.load_state_dict(checkpoint["opt_g"])
    opt_d.load_state_dict(checkpoint["opt_d"])

    start_epoch = int(re.findall(r'\d+', latest)[-1]) + 1

    return start_epoch


# ==============================
# EMA Update
# ==============================
def update_ema(model, ema_model, decay=0.9995):

    with torch.no_grad():

        for p, ema_p in zip(model.parameters(), ema_model.parameters()):
            ema_p.data.mul_(decay).add_(p.data, alpha=1 - decay)


# ==============================
# Training Function
# ==============================
def train_fibgan(
        data_dir,
        epochs=400,
        batch_size=16,
        checkpoints_dir="checkpoints"):

    os.makedirs(checkpoints_dir, exist_ok=True)

    set_seed()

    cudnn.benchmark = True

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    print(f"Training on {device}")

    # ==============================
    # Dataset
    # ==============================
    dataset = BeautifyDataset(root_dir=data_dir, image_size=512)

    num_workers = 8

    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True,
        persistent_workers=(num_workers > 0)
    )

    # ==============================
    # Models
    # ==============================
    gen = Generator(style_dim=512).to(device)
    disc = MultiScaleDiscriminator(in_channels=3).to(device)

    gen.train()
    disc.train()

    # EMA Generator
    gen_ema = copy.deepcopy(gen)
    gen_ema.eval()

    # ==============================
    # Loss
    # ==============================
    criterion = FiBGANLossAggregator(device=device)

    # ==============================
    # Optimizers (TTUR)
    # ==============================
    opt_g = Adam(gen.parameters(), lr=2e-4, betas=(0.0, 0.99))
    opt_d = Adam(disc.parameters(), lr=1e-4, betas=(0.0, 0.99))

    # ==============================
    # Resume Checkpoint
    # ==============================
    start_epoch = load_latest_checkpoint(
        checkpoints_dir,
        gen,
        disc,
        opt_g,
        opt_d,
        device
    )

    # ==============================
    # Mixed Precision
    # ==============================
    scaler = torch.cuda.amp.GradScaler(enabled=(device.type == "cuda"))

    # ==============================
    # Training Loop
    # ==============================
    for epoch in range(start_epoch, epochs):

        for i, batch in enumerate(loader):

            lq_imgs = batch["lq"].to(device, non_blocking=True)
            hq_imgs = batch["hq"].to(device, non_blocking=True)

            intensity = torch.empty(
                lq_imgs.size(0), 1,
                device=device
            ).uniform_(0.5, 1.0)

            # =====================================
            # Train Discriminator
            # =====================================
            opt_d.zero_grad(set_to_none=True)

            with torch.cuda.amp.autocast(enabled=(device.type=="cuda")):

                hq_imgs.requires_grad_(True)

                real_preds = disc(hq_imgs)

                with torch.no_grad():
                    fake_imgs = gen(lq_imgs, intensity)

                fake_preds = disc(fake_imgs.detach())

                loss_d = 0

                for r_pred, f_pred in zip(real_preds, fake_preds):
                    loss_d += criterion.get_d_loss(r_pred, f_pred)

                # R1 regularization
                if i % 16 == 0:

                r1_loss = 0

                for r_pred in real_preds:

                grad_real = torch.autograd.grad(
                    outputs=r_pred.sum(),
                    inputs=hq_imgs,
                    create_graph=True
                )[0]

                r1_loss += grad_real.pow(2).reshape(
                    grad_real.size(0), -1
                ).sum(1).mean()

            loss_d += 10 * r1_loss
        
            scaler.scale(loss_d).backward()

            torch.nn.utils.clip_grad_norm_(disc.parameters(), 1.0)

            scaler.step(opt_d)

            # =====================================
            # Train Generator
            # =====================================
            opt_g.zero_grad(set_to_none=True)

            with torch.cuda.amp.autocast(enabled=(device.type=="cuda")):

                fake_imgs = gen(lq_imgs, intensity)
                fake_preds = disc(fake_imgs)

                loss_g_total, loss_dict = criterion.get_g_loss(
                    fake_imgs,
                    hq_imgs,
                    fake_preds
                )

            if torch.isnan(loss_g_total):
                print("Skipping batch due to NaN loss")
                continue

            scaler.scale(loss_g_total).backward()

            torch.nn.utils.clip_grad_norm_(gen.parameters(), 1.0)

            scaler.step(opt_g)

            scaler.update()

            # =====================================
            # EMA Update
            # =====================================
            update_ema(gen, gen_ema)

            # =====================================
            # Logging
            # =====================================
            if i % 100 == 0:

                print(
                    f"[Epoch {epoch}/{epochs}] "
                    f"[Batch {i}/{len(loader)}] "
                    f"[D: {loss_d.item():.4f}] "
                    f"[G: {loss_g_total.item():.4f}] "
                    f"[adv: {loss_dict['adv']:.4f}] "
                    f"[perc: {loss_dict['perc']:.4f}] "
                    f"[id: {loss_dict['id']:.4f}] "
                    f"[l1: {loss_dict['l1']:.4f}] "
                    f"[fake_mean: {fake_imgs.mean().item():.3f}]"
                )

        # =====================================
        # Save Checkpoint Every 10 Epochs
        # =====================================
        if (epoch + 1) % 10 == 0:

            torch.save(
                {
                    "epoch": epoch,
                    "generator": gen.state_dict(),
                    "generator_ema": gen_ema.state_dict(),
                    "discriminator": disc.state_dict(),
                    "opt_g": opt_g.state_dict(),
                    "opt_d": opt_d.state_dict(),
                },
                os.path.join(
                    checkpoints_dir,
                    f"fibgan_epoch_{epoch}.pth"
                )
            )

            print(f"Checkpoint saved for epoch {epoch}")


# ==============================
# Main
# ==============================
if __name__ == "__main__":

    import argparse

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--data_dir",
        type=str,
        required=True,
        help="Path to dataset"
    )

    parser.add_argument(
        "--batch_size",
        type=int,
        default=8
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=100
    )

    args = parser.parse_args()

    train_fibgan(
        args.data_dir,
        epochs=args.epochs,
        batch_size=args.batch_size
    )

