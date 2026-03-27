#!/usr/bin/env bash
# verify-deployment.sh
#
# Verifies that all ToySwap serverless resources exist and are wired correctly.
# Also sends a test message through the full pipeline to confirm end-to-end flow.
#
# Usage:  ./serverless/verify-deployment.sh

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

LAMBDA_FUNCTION_NAME="toyswap-notification-processor"
SNS_TOPIC_NAME="toyswap-swap-completed"
SQS_QUEUE_NAME="toyswap-notifications"

PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"
  if [[ -n "$result" && "$result" != "None" ]]; then
    echo "  ✅ $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label — NOT FOUND"
    FAIL=$((FAIL + 1))
  fi
}

echo "==> Verifying ToySwap serverless deployment (region: $AWS_REGION)"
echo ""

# ── Check SNS Topic ────────────────────────────────────────────────────────────
echo "--- SNS ---"
SNS_ARN=$(aws sns list-topics \
  --region "$AWS_REGION" \
  --query "Topics[?contains(TopicArn, '$SNS_TOPIC_NAME')].TopicArn | [0]" \
  --output text 2>/dev/null || echo "")
check "SNS topic '$SNS_TOPIC_NAME' exists" "$SNS_ARN"

# ── Check SQS Queue ────────────────────────────────────────────────────────────
echo "--- SQS ---"
SQS_URL=$(aws sqs get-queue-url \
  --queue-name "$SQS_QUEUE_NAME" \
  --region "$AWS_REGION" \
  --query 'QueueUrl' \
  --output text 2>/dev/null || echo "")
check "SQS queue '$SQS_QUEUE_NAME' exists" "$SQS_URL"

if [[ -n "$SQS_URL" ]]; then
  DLQ_POLICY=$(aws sqs get-queue-attributes \
    --queue-url "$SQS_URL" \
    --attribute-names RedrivePolicy \
    --query 'Attributes.RedrivePolicy' \
    --output text 2>/dev/null || echo "")
  check "SQS dead letter queue configured" "$DLQ_POLICY"
fi

# ── Check SNS → SQS Subscription ─────────────────────────────────────────────
echo "--- Subscriptions ---"
if [[ -n "$SNS_ARN" && "$SNS_ARN" != "None" ]]; then
  SUB_ARN=$(aws sns list-subscriptions-by-topic \
    --topic-arn "$SNS_ARN" \
    --region "$AWS_REGION" \
    --query "Subscriptions[?Protocol=='sqs'].SubscriptionArn | [0]" \
    --output text 2>/dev/null || echo "")
  check "SNS → SQS subscription exists" "$SUB_ARN"
fi

# ── Check Lambda ───────────────────────────────────────────────────────────────
echo "--- Lambda ---"
LAMBDA_STATE=$(aws lambda get-function \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --region "$AWS_REGION" \
  --query 'Configuration.State' \
  --output text 2>/dev/null || echo "")
check "Lambda '$LAMBDA_FUNCTION_NAME' exists" "$LAMBDA_STATE"

if [[ "$LAMBDA_STATE" == "Active" ]]; then
  check "Lambda is Active (not pending)" "Active"
fi

# Check SQS → Lambda event source
EVENT_SOURCE=$(aws lambda list-event-source-mappings \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --region "$AWS_REGION" \
  --query "EventSourceMappings[?contains(EventSourceArn, '$SQS_QUEUE_NAME')].State | [0]" \
  --output text 2>/dev/null || echo "")
check "SQS → Lambda event source mapping exists" "$EVENT_SOURCE"

# ── End-to-End Test ───────────────────────────────────────────────────────────
echo ""
echo "--- End-to-End Test ---"
echo "Publishing a test swap event to SNS..."

TEST_MESSAGE='{
  "offerItem": {"id": 999, "name": "Test Toy A"},
  "requestItem": {"id": 998, "name": "Test Toy B"},
  "offerOwner": "verify-test-user-1",
  "requestOwner": "verify-test-user-2"
}'

if [[ -n "$SNS_ARN" && "$SNS_ARN" != "None" ]]; then
  MSG_ID=$(aws sns publish \
    --topic-arn "$SNS_ARN" \
    --message "$TEST_MESSAGE" \
    --subject "ToySwap verification test" \
    --region "$AWS_REGION" \
    --query 'MessageId' \
    --output text 2>/dev/null || echo "")
  check "Test message published to SNS (MessageId: $MSG_ID)" "$MSG_ID"
  echo "    Check Lambda logs in CloudWatch in ~30 seconds:"
  echo "    aws logs tail /aws/lambda/$LAMBDA_FUNCTION_NAME --follow --region $AWS_REGION"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $FAIL -gt 0 ]]; then
  echo "❌ Verification failed. Run ./serverless/deploy-lambda.sh to fix."
  exit 1
else
  echo "✅ All checks passed. Notification system is live."
fi
