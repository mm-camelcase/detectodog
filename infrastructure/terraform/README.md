# DetectoDog AWS infrastructure

This single Terraform stack manages the production portfolio environment in `eu-west-1`: ECR, a container-based Lambda, API Gateway HTTP API, short-retention logs, throttling, concurrency limits, and AWS budget notifications.

## First deployment

Terraform cannot create a Lambda until an image exists. Create `terraform.tfvars` first, using a temporary syntactically valid image URI with your account ID, then bootstrap only ECR:

```bash
terraform init
cp terraform.tfvars.example terraform.tfvars
# Edit budget_email and replace the AWS account ID in image_uri.
terraform apply -target=aws_ecr_repository.api

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.eu-west-1.amazonaws.com"
docker build --platform linux/amd64 -f ../../api/Dockerfile -t detectodog-api ../..
docker tag detectodog-api:latest "${AWS_ACCOUNT_ID}.dkr.ecr.eu-west-1.amazonaws.com/detectodog-api:1.0.0"
docker push "${AWS_ACCOUNT_ID}.dkr.ecr.eu-west-1.amazonaws.com/detectodog-api:1.0.0"
```

Get the pushed digest, create `terraform.tfvars` from the example, and set `image_uri` to the immutable digest URI:

```bash
aws ecr describe-images --repository-name detectodog-api --region eu-west-1
terraform plan -out=detectodog.tfplan
terraform apply detectodog.tfplan
terraform output -raw api_url
```

Copy the API URL into `app/.env` as `EXPO_PUBLIC_API_URL`.

## Publish the web/PWA build

Build with the deployed API URL, sync to the private S3 bucket, and invalidate CloudFront:

```bash
cd ../../app
cp .env.example .env
# Edit EXPO_PUBLIC_API_URL in .env
npm install
npm run export:web

WEB_BUCKET=$(terraform -chdir=../infrastructure/terraform output -raw web_bucket)
DISTRIBUTION_ID=$(terraform -chdir=../infrastructure/terraform output -raw cloudfront_distribution_id)
aws s3 sync dist/ "s3://${WEB_BUCKET}/" --delete
aws cloudfront create-invalidation --distribution-id "${DISTRIBUTION_ID}" --paths '/*'
terraform -chdir=../infrastructure/terraform output -raw web_url
```

The CloudFront URL serves the installable PWA over HTTPS. Android browsers expose **Install app**; on iPhone use Safari's **Add to Home Screen**.

State is local by default for this one-person portfolio deployment and is gitignored. If this becomes a shared project, migrate it to an encrypted, versioned S3 backend before collaborating.

AWS Budgets notifications must be confirmed through the subscription email before alerts become active. A budget warns; it does not automatically stop AWS resources. Lambda concurrency and API throttles are the hard usage controls.
