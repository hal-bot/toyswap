"""
ToySwap Notification Lambda Handler

Triggered by SQS messages (which come from SNS via SQS subscription).
Each message represents a completed toy swap event.

Event flow:
  SwapController (Spring Boot)
    → publishes to SNS topic: toyswap-swap-completed
    → SNS pushes to SQS queue: toyswap-notifications
    → this Lambda processes each SQS message

SQS Message body (from SNS → SQS) contains the SNS envelope:
{
  "Type": "Notification",
  "Message": "{\"offerItem\": {...}, \"requestItem\": {...},
               \"offerOwner\": \"...\", \"requestOwner\": \"...\"}"
}
"""

import json
import logging
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    """
    Main Lambda entry point. Processes a batch of SQS records.
    SQS delivers up to 10 messages per invocation.
    """
    logger.info("Received %d SQS records", len(event.get("Records", [])))

    for record in event["Records"]:
        try:
            process_record(record)
        except Exception as exc:
            logger.error("Failed to process record %s: %s", record.get("messageId"), exc)
            # Re-raise to signal SQS to not delete this message (it will retry)
            raise

    return {"statusCode": 200, "processed": len(event.get("Records", []))}


def process_record(record):
    """
    Unwrap the SNS-over-SQS envelope and handle the swap event.
    """
    raw_body = json.loads(record["body"])

    # SNS wraps the message in an envelope when delivering to SQS
    if raw_body.get("Type") == "Notification":
        swap_event = json.loads(raw_body["Message"])
    else:
        # Direct SQS message (e.g. from local testing)
        swap_event = raw_body

    offer_item = swap_event.get("offerItem", {})
    request_item = swap_event.get("requestItem", {})
    offer_owner = swap_event.get("offerOwner", "unknown")
    request_owner = swap_event.get("requestOwner", "unknown")

    logger.info(
        "Swap completed: '%s' (owned by %s) ↔ '%s' (owned by %s)",
        offer_item.get("name"),
        offer_owner,
        request_item.get("name"),
        request_owner,
    )

    send_notification(
        recipient=offer_owner,
        their_item=offer_item.get("name", "your item"),
        received_item=request_item.get("name", "an item"),
    )
    send_notification(
        recipient=request_owner,
        their_item=request_item.get("name", "your item"),
        received_item=offer_item.get("name", "an item"),
    )


def send_notification(recipient: str, their_item: str, received_item: str):
    """
    Send a notification for a completed swap.
    In production this would send an email via SES, push notification, etc.
    Currently logs the notification — replace with real delivery mechanism.
    """
    message = (
        f"Hi {recipient}! Your swap is complete. "
        f"You traded '{their_item}' and received '{received_item}'. "
        f"Enjoy your new toy!"
    )
    logger.info("NOTIFICATION → %s: %s", recipient, message)

    # TODO: replace with real delivery:
    # import boto3
    # ses = boto3.client('ses', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
    # ses.send_email(
    #     Source='noreply@toyswap.example.com',
    #     Destination={'ToAddresses': [f'{recipient}@example.com']},
    #     Message={
    #         'Subject': {'Data': 'Your ToySwap is complete!'},
    #         'Body': {'Text': {'Data': message}}
    #     }
    # )
