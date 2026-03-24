"""
Unit tests for the ToySwap notification Lambda handler.
Run with: python -m pytest serverless/lambda/test_notification_handler.py -v
"""

import json
import pytest
from unittest.mock import patch, call
from notification_handler import handler, process_record, send_notification


# ─── Helpers ──────────────────────────────────────────────────────────────────

def make_sqs_record(body: dict, message_id: str = "msg-001") -> dict:
    return {
        "messageId": message_id,
        "body": json.dumps(body),
    }


def make_sns_envelope(swap_event: dict) -> dict:
    """Simulates how SNS wraps a message when delivering to SQS."""
    return {
        "Type": "Notification",
        "Message": json.dumps(swap_event),
    }


SAMPLE_SWAP_EVENT = {
    "offerItem": {"id": 1, "name": "Bluey Stuffed Animal"},
    "requestItem": {"id": 2, "name": "LEGO City Set"},
    "offerOwner": "bingo",
    "requestOwner": "bluey",
}


# ─── Tests ────────────────────────────────────────────────────────────────────

class TestHandler:
    def test_handler_returns_200_for_empty_records(self):
        result = handler({"Records": []}, {})
        assert result["statusCode"] == 200
        assert result["processed"] == 0

    def test_handler_processes_all_records(self):
        record = make_sqs_record(make_sns_envelope(SAMPLE_SWAP_EVENT))
        event = {"Records": [record, record]}
        result = handler(event, {})
        assert result["statusCode"] == 200
        assert result["processed"] == 2

    def test_handler_reraises_on_processing_error(self):
        bad_record = {"messageId": "bad", "body": "not valid json{{{"}
        with pytest.raises(Exception):
            handler({"Records": [bad_record]}, {})


class TestProcessRecord:
    def test_unwraps_sns_envelope(self):
        record = make_sqs_record(make_sns_envelope(SAMPLE_SWAP_EVENT))
        with patch("notification_handler.send_notification") as mock_notify:
            process_record(record)
            assert mock_notify.call_count == 2

    def test_handles_direct_sqs_message(self):
        """Direct SQS messages (no SNS envelope) should also work."""
        record = make_sqs_record(SAMPLE_SWAP_EVENT)
        with patch("notification_handler.send_notification") as mock_notify:
            process_record(record)
            assert mock_notify.call_count == 2

    def test_notifies_both_parties(self):
        record = make_sqs_record(make_sns_envelope(SAMPLE_SWAP_EVENT))
        with patch("notification_handler.send_notification") as mock_notify:
            process_record(record)
            calls = mock_notify.call_args_list
            recipients = {c.kwargs["recipient"] for c in calls}
            assert "bingo" in recipients
            assert "bluey" in recipients

    def test_offer_owner_receives_request_item(self):
        record = make_sqs_record(make_sns_envelope(SAMPLE_SWAP_EVENT))
        with patch("notification_handler.send_notification") as mock_notify:
            process_record(record)
            bingo_call = next(
                c for c in mock_notify.call_args_list if c.kwargs["recipient"] == "bingo"
            )
            assert bingo_call.kwargs["received_item"] == "LEGO City Set"
            assert bingo_call.kwargs["their_item"] == "Bluey Stuffed Animal"

    def test_request_owner_receives_offer_item(self):
        record = make_sqs_record(make_sns_envelope(SAMPLE_SWAP_EVENT))
        with patch("notification_handler.send_notification") as mock_notify:
            process_record(record)
            bluey_call = next(
                c for c in mock_notify.call_args_list if c.kwargs["recipient"] == "bluey"
            )
            assert bluey_call.kwargs["received_item"] == "Bluey Stuffed Animal"
            assert bluey_call.kwargs["their_item"] == "LEGO City Set"


class TestSendNotification:
    def test_logs_notification(self, caplog):
        import logging
        with caplog.at_level(logging.INFO):
            send_notification(
                recipient="bingo",
                their_item="Bluey Stuffed Animal",
                received_item="LEGO City Set",
            )
        assert "bingo" in caplog.text
        assert "LEGO City Set" in caplog.text
