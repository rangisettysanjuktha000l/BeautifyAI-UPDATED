import os
import random
from PIL import Image, UnidentifiedImageError
import torch
from torch.utils.data import Dataset
import torchvision.transforms as transforms
import torchvision.transforms.functional as TF


class BeautifyDataset(Dataset):
    """
    Given an HQ dataset (like CelebA-HQ), produces pairs:
    (Low Quality Image, High Quality Image).
    The degradation simulates real-world low quality photos.
    """

    def __init__(self, root_dir, image_size=512):

        self.root_dir = root_dir
        self.image_size = image_size

        # Collect valid image files
        self.image_files = []

        for f in os.listdir(root_dir):
            if f.lower().endswith((".png", ".jpg", ".jpeg")):
                self.image_files.append(f)

        if len(self.image_files) == 0:
            raise RuntimeError("Dataset folder contains no valid images.")

        # Shuffle dataset
        random.shuffle(self.image_files)

        # Ground Truth Transform
        self.gt_transform = transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(
                (0.5, 0.5, 0.5),
                (0.5, 0.5, 0.5)
            )
        ])


    # =====================================
    # Image Degradation Pipeline
    # =====================================
    def degrade_image(self, img):

        # 1. Random Blur
        if random.random() < 0.3:
            kernel_size = random.choice([3,5])
            img = TF.gaussian_blur(img, kernel_size=kernel_size)

        # 2. Downsample and Upsample
        scale = random.uniform(0.6, 0.9)

        w, h = img.size
        small_w = int(w * scale)
        small_h = int(h * scale)

        img = TF.resize(img, (small_h, small_w), interpolation=Image.BILINEAR)
        img = TF.resize(img, (h, w), interpolation=Image.BICUBIC)

        # 3. Convert to tensor
        img_t = TF.to_tensor(img)

        # 4. Add Gaussian Noise
        if random.random() < 0.5:
            noise = torch.randn_like(img_t) * random.uniform(0.02,0.04)
            img_t = img_t + noise
            img_t = torch.clamp(img_t, 0.0, 1.0)

        # Normalize to [-1,1]
        img_t = TF.normalize(
            img_t,
            (0.5,0.5,0.5),
            (0.5,0.5,0.5)
        )

        return img_t


    def __len__(self):
        return len(self.image_files)


    def __getitem__(self, idx):

        img_path = os.path.join(
            self.root_dir,
            self.image_files[idx]
        )

        try:
            hq_img = Image.open(img_path).convert("RGB")

            # Random horizontal flip
            if random.random() < 0.5:
                hq_img = TF.hflip(hq_img)

        except (UnidentifiedImageError, OSError):
            # If corrupted image, load another one
            new_idx = random.randint(0, len(self.image_files)-1)
            return self.__getitem__(new_idx)

        # Target Image
        real_img = self.gt_transform(hq_img)

        # Degraded Input Image
        degraded_img = self.degrade_image(hq_img)

        # Ensure degraded image same size
        degraded_img = TF.resize(
            degraded_img,
            (self.image_size, self.image_size)
        )

        return {
            "lq": degraded_img,
            "hq": real_img
        }

