import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models

# Try loading FaceNet
try:
    from facenet_pytorch import InceptionResnetV1
except:
    InceptionResnetV1 = None


# =====================================
# Non-Saturating GAN Loss
# =====================================
class NonSaturatingGANLoss(nn.Module):

    def __init__(self):
        super().__init__()

    def d_loss(self, real_preds, fake_preds):

        real_loss = F.softplus(-real_preds)
        fake_loss = F.softplus(fake_preds)

        return real_loss.mean() + fake_loss.mean()

    def g_loss(self, fake_preds):

        return F.softplus(-fake_preds).mean()


# =====================================
# Perceptual Loss (VGG19)
# =====================================
class PerceptualLoss(nn.Module):

    def __init__(self, device="cuda"):
        super().__init__()

        vgg = models.vgg19(
            weights=models.VGG19_Weights.IMAGENET1K_V1
        ).features

        # Use first 3 blocks
        self.blocks = nn.ModuleList([
            vgg[:4].eval(),
            vgg[4:9].eval(),
            vgg[9:18].eval()
        ]).to(device)

        for p in self.parameters():
            p.requires_grad = False

        self.criterion = nn.L1Loss()

        # VGG normalization
        self.register_buffer(
            "mean",
            torch.tensor([0.485, 0.456, 0.406]).view(1,3,1,1)
        )

        self.register_buffer(
            "std",
            torch.tensor([0.229, 0.224, 0.225]).view(1,3,1,1)
        )


    def normalize(self, x):

        x = (x + 1) / 2
        return (x - self.mean) / self.std


    def forward(self, input, target):

        x = self.normalize(input)
        y = self.normalize(target)

        loss = 0

        for block in self.blocks:

            x = block(x)
            y = block(y)

            loss += self.criterion(x, y)

        return loss


# =====================================
# Identity Loss (FaceNet)
# =====================================
class IdentityLoss(nn.Module):

    def __init__(self, device="cuda"):
        super().__init__()

        if InceptionResnetV1 is None:

            print("facenet_pytorch not installed → identity loss disabled")
            self.net = None

        else:

            try:

                self.net = InceptionResnetV1(
                    pretrained="vggface2"
                ).eval().to(device)

                for p in self.net.parameters():
                    p.requires_grad = False

            except:

                print("FaceNet could not load → identity loss disabled")
                self.net = None


    def forward(self, input, target):

        if self.net is None:
            return input.new_tensor(0.0)

        # Convert [-1,1] → [0,1]
        x = (input + 1) / 2
        y = (target + 1) / 2

        x = F.interpolate(
            x,
            size=(160,160),
            mode="bilinear",
            align_corners=False
        )

        y = F.interpolate(
            y,
            size=(160,160),
            mode="bilinear",
            align_corners=False
        )

        # Forward through FaceNet
        feat_x = self.net(x)
        feat_y = self.net(y)

        loss = 1 - F.cosine_similarity(
            feat_x,
            feat_y,
            dim=1
        ).mean()

        return loss


# =====================================
# FiBGAN Loss Aggregator
# =====================================
class FiBGANLossAggregator(nn.Module):

    def __init__(self, device="cuda"):
        super().__init__()

        self.adv_loss = NonSaturatingGANLoss()

        self.perceptual_loss = PerceptualLoss(device)

        self.identity_loss = IdentityLoss(device)

        self.l1_loss = nn.L1Loss()

        # Loss weights
        self.lambda_adv = 1.0
        self.lambda_perc = 1.0
        self.lambda_id = 0.1
        self.lambda_l1 = 10.0


    # ==============================
    # Discriminator Loss
    # ==============================
    def get_d_loss(self, real_preds, fake_preds):

        return self.adv_loss.d_loss(
            real_preds,
            fake_preds
        )


    # ==============================
    # Generator Loss
    # ==============================
    def get_g_loss(self, fake_img, real_img, fake_preds):

        # Multi-scale adversarial aggregation
        adv_loss = 0

        for pred in fake_preds:
            adv_loss += self.adv_loss.g_loss(pred)

        adv_loss *= self.lambda_adv

        perc_loss = self.perceptual_loss(
            fake_img,
            real_img
        ) * self.lambda_perc

        id_loss = self.identity_loss(
            fake_img,
            real_img
        ) * self.lambda_id

        l1_loss = self.l1_loss(
            fake_img,
            real_img
        ) * self.lambda_l1

        total = adv_loss + perc_loss + id_loss + l1_loss

        return total, {
            "adv": adv_loss.item(),
            "perc": perc_loss.item(),
            "id": id_loss.item(),
            "l1": l1_loss.item()
        }
