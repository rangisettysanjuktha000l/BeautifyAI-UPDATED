import torch
import torch.nn as nn
import torch.nn.functional as F


# ==========================================
# Weight Initialization
# ==========================================
def init_weights(m):

    if isinstance(m, nn.Conv2d):

        if hasattr(m, "weight_orig"):
            nn.init.kaiming_normal_(m.weight_orig, a=0.2)
        else:
            nn.init.kaiming_normal_(m.weight, a=0.2)

        if m.bias is not None:
            nn.init.zeros_(m.bias)


# ==========================================
# Residual Block for Discriminator
# ==========================================
class ResidualBlock(nn.Module):

    def __init__(self, in_c, out_c, stride=2):
        super().__init__()

        self.conv1 = nn.utils.spectral_norm(
            nn.Conv2d(in_c, out_c, 3, stride, 1)
        )

        self.conv2 = nn.utils.spectral_norm(
            nn.Conv2d(out_c, out_c, 3, 1, 1)
        )

        # Use identity skip if possible
        if in_c == out_c and stride == 1:
            self.skip = nn.Identity()
        else:
            self.skip = nn.utils.spectral_norm(
                nn.Conv2d(in_c, out_c, 1, stride, 0)
            )

        self.act = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):

        residual = self.skip(x)

        out = self.act(self.conv1(x))
        out = self.conv2(out)

        out = self.act(out + residual)

        return out


# ==========================================
# Minibatch Standard Deviation Layer
# ==========================================
class MinibatchStdDev(nn.Module):

    def __init__(self, eps=1e-8):
        super().__init__()
        self.eps = eps

    def forward(self, x):

        batch, _, h, w = x.shape

        # Compute standard deviation across batch
        std = torch.sqrt(x.var(dim=0, unbiased=False) + self.eps)

        # Average std across channels and pixels
        mean_std = std.mean()

        std_map = mean_std.expand(batch, 1, h, w)

        return torch.cat([x, std_map], dim=1)


# ==========================================
# PatchGAN Discriminator
# ==========================================
class PatchGANDiscriminator(nn.Module):

    def __init__(self, in_channels=3, base_channels=64):
        super().__init__()

        base = base_channels

        self.net = nn.Sequential(

            ResidualBlock(in_channels, base),
            ResidualBlock(base, base*2),
            ResidualBlock(base*2, base*4),
            ResidualBlock(base*4, base*8),

            MinibatchStdDev(),

            nn.utils.spectral_norm(
                nn.Conv2d(base*8 + 1, base*8, 3, 1, 1)
            ),

            nn.LeakyReLU(0.2, inplace=True),

            nn.utils.spectral_norm(
                nn.Conv2d(base*8, 1, 3, 1, 1)
            )
        )

        self.apply(init_weights)

    def forward(self, x):

        return self.net(x)


# ==========================================
# Multi Scale Discriminator
# ==========================================
class MultiScaleDiscriminator(nn.Module):

    def __init__(self, in_channels=3):
        super().__init__()

        self.d1 = PatchGANDiscriminator(in_channels)
        self.d2 = PatchGANDiscriminator(in_channels)

        # Downsample between scales
        self.downsample = nn.AvgPool2d(2)

    def forward(self, x):

        # Scale 1 (original resolution)
        out1 = self.d1(x)

        # Scale 2 (downsampled)
        x_down = self.downsample(x)

        out2 = self.d2(x_down)

        return [out1, out2]
