#!/usr/bin/env bash
# deploy-lambda.sh
#
# Deploys the ToySwap serverless notification system to AWS.
# Creates: IAM role, SNS topic, SQS queue, Lambda function, and wires them together.
#
# Prerequisites:
#   - AWS CLI configured (aws-azure-login or aws configure)
#   - Python 3.9+ installed
#   - Sufficient IAM permissions to create Lambda, SNS, SQS, and IAM roles
#
# Usage:
#   ./serverless/deploy-lambda.sh
#   AWS_PROFILE=my-profile ./serverless/deploy-lambda.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDA_DIR="$SCRIPT_DIR/lambda"

# ── Configuration ─────────────────────────────────────────────────────────────
AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

LAMBDA_FUNCTION_NAME="toyswap-notification-processor"
SNS_TOPIC_NAME="toyswap-swap-completed"
SQS_QUEUE_NAME="toyswap-notifications"
SQS_DLQ_NAME="toyswap-notifications-dlq"
IAM_ROLE_NAME="toyswap-lambda-role"

echo "==> Deploying ToySwap notification system"
echo "    Account: $ACCOUNT_ID"
echo "    Region:  $AWS_REGION"
echo ""

# ── Step 1: Create/resolve IAM Role for Lambda ────────────────────────────────
echo "==> Step 1: Creating IAM role '$IAM_ROLE_NAME' (with Lambda trust)..."

TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

# Try to create the role; if it already exists, fetch its ARN
ROLE_ARN=$(aws iam create-role \
  --role-name "$IAM_ROLE_NAME" \
  --assume-role-policy-document "$TRUST_POLICY" \
  --query 'Role.Arn' --output text 2>/dev/null) || \
ROLE_ARN=$(aws iam get-role \
  --role-name "$IAM_ROLE_NAME" \
  --query 'Role.Arn' --output text)

# Attach basic execution + SQS trigger policies (ignore errors if already attached)
aws iam attach-role-policy \
  --role-name "$IAM_ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true

aws iam attach-role-policy \
  --role-name "$IAM_ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole 2>/dev/null || true

echo "    Role ARN: $ROLE_ARN"
echo "    Waiting 10s for role to propagate..."
sleep 10

# ── Step 2: Create SNS Topic ───────────────────────────────────────────────────
echo "==> Step 2: Creating SNS topic '$SNS_TOPIC_NAME'..."

SNS_TOPIC_ARN=$(aws sns create-topic \
  --name "$SNS_TOPIC_NAME" \
  --region "$AWS_REGION" \
  --query 'TopicArn' \
  --output text)

echo "    SNS Topic ARN: $SNS_TOPIC_ARN"

# ── Step 3: Create SQS Dead Letter Queue ──────────────────────────────────────
echo "==> Step 3: Creating SQS dead letter queue '$SQS_DLQ_NAME'..."

DLQ_URL=$(aws sqs create-queue \
  --queue-name "$SQS_DLQ_NAME" \
  --region "$AWS_REGION" \
  --query 'QueueUrl' \
  --output text 2>/dev/null) || \
DLQ_URL=$(aws sqs get-queue-url \
  --queue-name "$SQS_DLQ_NAME" \
  --region "$AWS_REGION" \
  --query 'QueueUrl' \
  --output text)

DLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url "$DLQ_URL" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

echo "    DLQ ARN: $DLQ_ARN"

# ── Step 4: Create SQS Main Queue ─────────────────────────────────────────────
echo "==> Step 4: Creating SQS queue '$SQS_QUEUE_NAME'..."

SQS_QUEUE_URL=$(aws sqs create-queue \
  --queue-name "$SQS_QUEUE_NAME" \
  --region "$AWS_REGION" \
  --attributes "{
    \"VisibilityTimeout\": \"60\",
    \"MessageRetentionPeriod\": \"86400\",
    \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"
  }" \
  --query 'QueueUrl' \
  --output text 2>/dev/null) || \
SQS_QUEUE_URL=$(aws sqs get-queue-url \
  --queue-name "$SQS_QUEUE_NAME" \
  --region "$AWS_REGION" \
  --query 'QueueUrl' \
  --output text)

SQS_QUEUE_ARN=$(aws sqs get-queue-attributes \
  --queue-url "$SQS_QUEUE_URL" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

echo "    SQS Queue URL: $SQS_QUEUE_URL"
echo "    SQS Queue ARN: $SQS_QUEUE_ARN"

# ── Step 5: Allow SNS to send to SQS ─────────────────────────────────────────
echo "==> Step 5: Granting SNS permission to send to SQS..."

SQS_POLICY="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Effect\": \"Allow\",
    \"Principal\": { \"Service\": \"sns.amazonaws.com\" },
    \"Action\": \"sqs:SendMessage\",
    \"Resource\": \"$SQS_QUEUE_ARN\",
    \"Condition\": {
      \"ArnEquals\": { \"aws:SourceArn\": \"$SNS_TOPIC_ARN\" }
    }
  }]
}"

aws sqs set-queue-attributes \
  --queue-url "$SQS_QUEUE_URL" \
  --attributes "{\"Policy\": $(echo "$SQS_POLICY" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}"

# ── Step 6: Subscribe SQS to SNS ──────────────────────────────────────────────
echo "==> Step 6: Subscribing SQS queue to SNS topic..."

SUBSCRIPTION_ARN=$(aws sns subscribe \
  --topic-arn "$SNS_TOPIC_ARN" \
  --protocol sqs \
  --notification-endpoint "$SQS_QUEUE_ARN" \
  --query 'SubscriptionArn' \
  --output text)

echo "    Subscription ARN: $SUBSCRIPTION_ARN"

# ── Step 7: Package and Deploy Lambda ─────────────────────────────────────────
echo "==> Step 7: Packaging Lambda function..."

PACKAGE_DIR=$(mktemp -d)
cp "$LAMBDA_DIR/notification_handler.py" "$PACKAGE_DIR/"
ZIP_FILE="/tmp/toyswap-notification-lambda.zip"
(cd "$PACKAGE_DIR" && zip -q "$ZIP_FILE" notification_handler.py)
rm -rf "$PACKAGE_DIR"
echo "    Package: $ZIP_FILE"

echo "==> Step 7b: Deploying Lambda function '$LAMBDA_FUNCTION_NAME'..."

EXISTING_LAMBDA=$(aws lambda get-function \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --region "$AWS_REGION" \
  --query 'Configuration.FunctionArn' \
  --output text 2>/dev/null || echo "")

if [ -z "$EXISTING_LAMBDA" ]; then
  echo "    Creating new function..."
  aws lambda create-function \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --runtime python3.12 \
    --role "$ROLE_ARN" \
    --handler notification_handler.handler \
    --zip-file "fileb://$ZIP_FILE" \
    --timeout 30 \
    --memory-size 128 \
    --region "$AWS_REGION"
  echo "    Waiting for function to become active..."
  aws lambda wait function-active \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION"
else
  echo "    Function exists — updating code..."
  aws lambda update-function-code \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --zip-file "fileb://$ZIP_FILE" \
    --region "$AWS_REGION" > /dev/null
fi

LAMBDA_ARN="arn:aws:lambda:$AWS_REGION:$ACCOUNT_ID:function:$LAMBDA_FUNCTION_NAME"
echo "    Lambda ARN: $LAMBDA_ARN"

# ── Step 8: Wire SQS → Lambda trigger ─────────────────────────────────────────
echo "==> Step 8: Adding SQS event source mapping to Lambda..."

aws lambda create-event-source-mapping \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --event-source-arn "$SQS_QUEUE_ARN" \
  --batch-size 10 \
  --region "$AWS_REGION" 2>/dev/null || echo "    (event source mapping already exists)"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "✅ Deployment complete!"
echo ""
echo "Resources created:"
echo "  IAM Role:      $ROLE_ARN"
echo "  SNS Topic:     $SNS_TOPIC_ARN"
echo "  SQS Queue:     $SQS_QUEUE_URL"
echo "  SQS DLQ:       $DLQ_URL"
echo "  Lambda:        $LAMBDA_ARN"
echo ""
echo "Set this environment variable on your Spring Boot backend:"
echo "  TOYSWAP_SNS_TOPIC_ARN=$SNS_TOPIC_ARN"
echo ""
echo "Run the verify script to confirm everything is wired correctly:"
echo "  ./serverless/verify-deployment.sh"
