# DetectoDog API

FastAPI performs the final notebook's 300×300 preprocessing and runs the exported EfficientNet-B0 graph with ONNX Runtime CPU. The same application runs locally under Uvicorn and in AWS Lambda through Mangum.

## Local run

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r api/requirements-dev.txt
PYTHONPATH=api uvicorn app.main:app --reload
```

Test with:

```bash
curl -F image=@dog.jpg http://127.0.0.1:8000/v1/predict
```

Uploads are limited to 2 MB, decoded in memory, and not persisted. The model is a closed-set classifier: uncertainty is inferred from its confidence, but it cannot reliably prove that an image contains a dog.

## Re-export the serving model

The original PyTorch checkpoint remains under `experiments/models/`. Export is a build-time operation; PyTorch is not installed in the production image.

```bash
pip install -r api/requirements-export.txt
PYTHONPATH=api python api/scripts/export_onnx.py
```

The export script validates the ONNX graph and verifies logits and top-three classes against PyTorch.
