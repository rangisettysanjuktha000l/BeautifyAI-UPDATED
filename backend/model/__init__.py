# model/__init__.py

# Expose core components for easy import

from .generator import Generator
from .discriminator import PatchGANDiscriminator, MultiScaleDiscriminator

# Keep the public name "Discriminator" for compatibility.
Discriminator = PatchGANDiscriminator

# Optional: define what gets imported with "from model import *"
__all__ = [
    "Generator",
    "Discriminator",
    "MultiScaleDiscriminator",
]
