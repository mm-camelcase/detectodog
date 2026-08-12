# DetectoDog

DetectoDog identifies the likely breed of a dog from a photograph. The model recognises 120 breeds and returns its three closest matches.

## App

The Expo app runs on Android and the web. It can take a photo or use one from the photo library, submit it for classification, save results locally and share a result.

The web app is an installable PWA. Android preview builds are produced as APK files through Expo EAS.

## Model and API

The classifier is an EfficientNet-B0 model trained on the Stanford Dogs data set. The production model runs as an 18 MB ONNX graph behind a small FastAPI service.

Photos are processed in memory and are not stored by the API.

## AWS

Terraform provisions one production environment in `eu-west-1`:

- API Gateway and Lambda for inference
- ECR for the API container
- S3 and CloudFront for the web app
- CloudWatch logs and an AWS budget alert

The Lambda scales to zero when unused. Expected portfolio usage is approximately €0–€5 per month.

## Development

Use Node.js 20 or newer.

```bash
cd app
cp .env.example .env
npm install
npm start
```

Set `EXPO_PUBLIC_API_URL` in `app/.env` before running the app.

Run the API with Python 3.12:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r api/requirements-dev.txt
PYTHONPATH=api uvicorn app.main:app --reload
```

## Checks

GitHub Actions checks the app, API and Terraform on every push and pull request. It also builds and launches the Android release on an emulator to catch startup crashes.

```bash
cd app
npm run verify
```

## Current limits

- Breed profiles are placeholders.
- Results are visual estimates, not genetic tests.
- The model only classifies the 120 breeds it was trained on.
