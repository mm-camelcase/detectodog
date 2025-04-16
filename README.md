# 🐕 DetectoDog: Dog Breed Classification

DetectoDog is a deep learning project that classifies dog breeds from images using transfer learning. The primary goal is to power a mobile application capable of identifying dog breeds from user-submitted photos.

## 📱 Project Goal

The final deliverable for this project is a **mobile application** that:
- Accepts an image of a dog
- Runs an optimised on-device model
- Displays the predicted breed with confidence score
- Optionally provides breed-related information

The training in this notebook prepares the model for deployment on resource-constrained environments (e.g. phones or tablets), using lightweight architectures and efficient inference strategies.

---

## 🧠 Model Training (Notebook Overview)

This notebook covers the training process for the DetectoDog classifier:

- ✅ Dataset download and preparation (Stanford Dogs Dataset)
- ✅ Data exploration and augmentation
- ✅ Transfer learning with ResNet50, MobileNetV2, and EfficientNet
- ✅ Accuracy evaluation and performance visualisation
- ✅ Exporting the final trained model

---

## 🔍 Dataset Summary

- **Dataset**: [Stanford Dogs Dataset](http://vision.stanford.edu/aditya86/ImageNetDogs/)
- **Classes**: 120 breeds
- **Images**: 20,580 total
- **Challenges**: Varying image quality, backgrounds, and angles

---

## 📦 Dependencies

```python
import torch
import torchvision
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from PIL import Image
from sklearn.metrics import classification_report
```

Also uses: `tqdm`, `yaml`, `tarfile`, `os`, `scipy.io`, etc.

---

## 🛠 Notebook Features

- Visualisation of class distributions
- Model training and validation curves
- Confusion matrix and metrics
- Sample inferences on unseen images
- Saving the best-performing model for export

---

## 📲 Mobile Deployment (Next Phase)

The next step will involve:
- Converting the model to **TorchScript** or **ONNX**
- Reducing size via pruning or quantisation
- Integrating the model into a mobile app via **React Native**, **Flutter**, or **Android Studio (Java/Kotlin)**
- Performing inference using a mobile-optimised runtime like **PyTorch Mobile** or **TensorFlow Lite**

---

## 🔮 Future Work

- Ensemble modelling to improve accuracy
- More advanced augmentations
- Real-time inference benchmarks
- Breed information popups in app

---

## 📁 Files

- `detectodog_final_structured.ipynb`: Full training notebook
- `expiriments/models/model.pt`: Exported model (after training)
- `README.md`: Project summary and roadmap


[![View detectodog notebook in nbviewer](https://img.shields.io/badge/View%20Notebook-nbviewer-orange)](https://nbviewer.org/github/mm-camelcase/detectodog/blob/main/detectodog_final_structured.ipynb)


