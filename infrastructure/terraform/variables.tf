variable "aws_region" {
  description = "AWS region for the portfolio deployment."
  type        = string
  default     = "eu-west-1"
}

variable "image_uri" {
  description = "Immutable ECR image URI, preferably including a sha256 digest."
  type        = string
}

variable "budget_email" {
  description = "Email address that receives AWS budget alerts."
  type        = string
}

variable "monthly_budget_usd" {
  description = "Monthly AWS budget threshold. AWS Budgets uses USD for this account budget."
  type        = number
  default     = 10
}

variable "lambda_memory_mb" {
  description = "Lambda memory allocation; CPU allocation scales with this value."
  type        = number
  default     = 3072
}

variable "lambda_reserved_concurrency" {
  description = "Hard cap on concurrent model executions to limit cost."
  type        = number
  default     = 3
}
