"""Training-compatible model definition used only when exporting to ONNX."""

from __future__ import annotations

import os
from pathlib import Path

import torch
from torch import nn
from torchvision import models


class DogBreedClassifier(nn.Module):
    def __init__(self, num_classes: int = 120, dropout_rate: float = 0.3) -> None:
        super().__init__()
        self.backbone = models.efficientnet_b0(weights=None)
        feature_dim = self.backbone.classifier[1].in_features
        self.backbone.classifier = nn.Identity()
        self.classifier = nn.Sequential(
            nn.Dropout(dropout_rate),
            nn.Linear(feature_dim, 512),
            nn.ReLU(),
            nn.Dropout(dropout_rate / 2),
            nn.Linear(512, num_classes),
        )

    def forward(self, image: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.backbone(image))


def load_pytorch_model() -> DogBreedClassifier:
    checkpoint = Path(os.getenv("MODEL_PATH", "experiments/models/best_model.pt"))
    model = DogBreedClassifier()
    model.load_state_dict(torch.load(checkpoint, map_location="cpu", weights_only=True))
    return model.eval()
