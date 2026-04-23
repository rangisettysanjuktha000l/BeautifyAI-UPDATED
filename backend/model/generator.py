import torch
import torch.nn as nn
import torch.nn.functional as F


# ==========================
# Weight Initialization
# ==========================
def init_weights(m):
    if isinstance(m, nn.Conv2d) or isinstance(m, nn.Linear):
        nn.init.kaiming_normal_(m.weight, a=0.2)
        if m.bias is not None:
            nn.init.zeros_(m.bias)


# ==========================
# PixelNorm (Style Normalization)
# ==========================
class PixelNorm(nn.Module):

    def __init__(self):
        super().__init__()

    def forward(self, x):
        return x / torch.sqrt(torch.mean(x ** 2, dim=1, keepdim=True) + 1e-8)


# ==========================
# Noise Injection
# ==========================
class NoiseInjection(nn.Module):

    def __init__(self, channels):
        super().__init__()
        self.weight = nn.Parameter(torch.zeros(1, channels, 1, 1))

    def forward(self, x, noise=None):

        b, c, h, w = x.shape

        if noise is None:
            noise = torch.randn(b, 1, h, w, device=x.device)

        return x + self.weight * noise


# ==========================
# Feature Pyramid Encoder
# ==========================
class PreEncoderFPN(nn.Module):

    def __init__(self, base=64):
        super().__init__()

        self.enc1 = nn.Conv2d(3, base, 3, 1, 1)
        self.enc2 = nn.Conv2d(base, base*2, 4, 2, 1)
        self.enc3 = nn.Conv2d(base*2, base*4, 4, 2, 1)
        self.enc4 = nn.Conv2d(base*4, base*8, 4, 2, 1)

        self.lat1 = nn.Conv2d(base,256,1)
        self.lat2 = nn.Conv2d(base*2,256,1)
        self.lat3 = nn.Conv2d(base*4,256,1)
        self.lat4 = nn.Conv2d(base*8,256,1)

        self.s1 = nn.Conv2d(256,256,3,1,1)
        self.s2 = nn.Conv2d(256,256,3,1,1)
        self.s3 = nn.Conv2d(256,256,3,1,1)

    def forward(self,x):

        c1 = F.leaky_relu(self.enc1(x),0.2)
        c2 = F.leaky_relu(self.enc2(c1),0.2)
        c3 = F.leaky_relu(self.enc3(c2),0.2)
        c4 = F.leaky_relu(self.enc4(c3),0.2)

        p4 = self.lat4(c4)

        p3 = self.lat3(c3) + F.interpolate(p4,scale_factor=2,mode="bilinear",align_corners=False)
        p3 = self.s3(p3)

        p2 = self.lat2(c2) + F.interpolate(p3,scale_factor=2,mode="bilinear",align_corners=False)
        p2 = self.s2(p2)

        p1 = self.lat1(c1) + F.interpolate(p2,scale_factor=2,mode="bilinear",align_corners=False)
        p1 = self.s1(p1)

        return p1,p2,p3,p4


# ==========================
# Style Extractor
# ==========================
class StyleExtractor(nn.Module):

    def __init__(self, style_dim=512):
        super().__init__()

        self.net = nn.Sequential(

            nn.Conv2d(3,64,4,2,1),
            nn.LeakyReLU(0.2),

            nn.Conv2d(64,128,4,2,1),
            nn.LeakyReLU(0.2),

            nn.Conv2d(128,256,4,2,1),
            nn.LeakyReLU(0.2),

            nn.Conv2d(256,512,4,2,1),
            nn.LeakyReLU(0.2),

            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(512,style_dim)
        )

    def forward(self,x):
        return self.net(x)


# ==========================
# Style Modulated Convolution
# ==========================
class ModulatedConv2d(nn.Module):

    def __init__(self,in_c,out_c,k,style_dim):
        super().__init__()

        self.weight = nn.Parameter(
            torch.randn(out_c,in_c,k,k) / (in_c * k * k) ** 0.5
        )

        self.bias = nn.Parameter(torch.zeros(out_c))

        self.mod = nn.Linear(style_dim,in_c)

        self.k = k
        self.in_c = in_c
        self.out_c = out_c

    def forward(self,x,style):

        b,c,h,w = x.shape

        style = self.mod(style).view(b,1,c,1,1)

        weight = self.weight.unsqueeze(0) * style

        demod = torch.rsqrt((weight**2).sum([2,3,4]) + 1e-8)
        weight = weight * demod.view(b,self.out_c,1,1,1)

        x = x.reshape(1,b*c,h,w)

        weight = weight.reshape(
            b*self.out_c,
            c,
            self.k,
            self.k
        )

        out = F.conv2d(
            x,
            weight,
            padding=self.k//2,
            groups=b
        )

        out = out.reshape(b,self.out_c,h,w)

        out = out + self.bias.view(1,-1,1,1)

        return out


# ==========================
# Styled Block
# ==========================
class StyledBlock(nn.Module):

    def __init__(self,in_c,out_c,style_dim):
        super().__init__()

        self.conv = ModulatedConv2d(in_c,out_c,3,style_dim)
        self.noise = NoiseInjection(out_c)

    def forward(self,x,w):

        x = self.conv(x,w)
        x = self.noise(x)

        return F.leaky_relu(x,0.2)


# ==========================
# RGB Skip Layer
# ==========================
class ToRGB(nn.Module):

    def __init__(self,in_c):
        super().__init__()

        self.conv = nn.Conv2d(in_c,3,1)

    def forward(self,x,skip=None):

        out = self.conv(x)

        if skip is not None:
            out = out + F.interpolate(skip,scale_factor=2,mode="bilinear",align_corners=False)

        return out


# ==========================
# Full Generator
# ==========================
class Generator(nn.Module):

    def __init__(self,style_dim=512):
        super().__init__()

        self.fpn = PreEncoderFPN()
        self.style = StyleExtractor(style_dim)
        self.pixel_norm = PixelNorm()

        # Mapping network
        mapping_layers = []
        for i in range(4):

            in_dim = style_dim + 1 if i == 0 else style_dim

            mapping_layers.append(nn.Linear(in_dim,style_dim))
            mapping_layers.append(nn.LeakyReLU(0.2))

        self.mapping = nn.Sequential(*mapping_layers)

        self.b4 = StyledBlock(256,256,style_dim)
        self.b3 = StyledBlock(256,256,style_dim)
        self.b2 = StyledBlock(256,128,style_dim)
        self.b1 = StyledBlock(128,64,style_dim)

        self.rgb4 = ToRGB(256)
        self.rgb3 = ToRGB(256)
        self.rgb2 = ToRGB(128)
        self.rgb1 = ToRGB(64)

        # Learnable pyramid fusion weights
        self.skip_p3 = nn.Parameter(torch.tensor(0.5))
        self.skip_p2 = nn.Parameter(torch.tensor(0.5))
        self.skip_p1 = nn.Parameter(torch.tensor(0.5))

        self.apply(init_weights)


    def forward(self,x,intensity=1.0):

        b = x.size(0)

        p1,p2,p3,p4 = self.fpn(x)

        style = self.style(x)

        style = self.pixel_norm(style)

        if not isinstance(intensity,torch.Tensor):
            intensity = torch.full((b,1),float(intensity),device=x.device)

        style = torch.cat([style,intensity],dim=1)

        w = self.mapping(style)

        out = self.b4(p4,w)
        rgb = self.rgb4(out)

        out = F.interpolate(out,scale_factor=2,mode="bilinear",align_corners=False)
        out = out + self.skip_p3 * p3
        out = self.b3(out,w)
        rgb = self.rgb3(out,rgb)

        out = F.interpolate(out,scale_factor=2,mode="bilinear",align_corners=False)
        out = out + self.skip_p2 * p2
        out = self.b2(out,w)
        rgb = self.rgb2(out,rgb)

        out = F.interpolate(out,scale_factor=2,mode="bilinear",align_corners=False)
        out = out + self.skip_p1 * p1
        out = self.b1(out,w)
        rgb = self.rgb1(out,rgb)

        return torch.tanh(rgb)
