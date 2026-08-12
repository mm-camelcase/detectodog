output "api_url" {
  description = "Base URL to set as EXPO_PUBLIC_API_URL."
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "ecr_repository_url" {
  description = "ECR repository used for the inference image."
  value       = aws_ecr_repository.api.repository_url
}

output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}

output "web_bucket" {
  description = "Upload app/dist to this private bucket."
  value       = aws_s3_bucket.web.id
}

output "web_url" {
  description = "Public HTTPS portfolio/PWA URL."
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.web.id
}
