package com.example.toyswap.service;

import com.example.toyswap.model.Item;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Publishes swap-completed events to AWS SNS when the environment variable
 * TOYSWAP_SNS_TOPIC_ARN is set. Falls back to logging only when running
 * locally without AWS credentials (dev/test with H2).
 *
 * Event flow:
 * SwapController → SwapEventPublisher → SNS topic "toyswap-swap-completed"
 * → SQS queue "toyswap-notifications"
 * → Lambda "toyswap-notification-processor"
 */
@Service
public class SwapEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(SwapEventPublisher.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String snsTopicArn;

    public SwapEventPublisher(@Value("${toyswap.sns.topicArn:}") String snsTopicArn) {
        this.snsTopicArn = snsTopicArn;
    }

    /**
     * Publishes a swap-completed event.
     * If SNS is not configured, logs the event instead (safe for local dev).
     */
    public void publishSwapCompleted(Item offerItem, Item requestItem) {
        try {
            Map<String, Object> event = Map.of(
                    "offerItem", Map.of("id", offerItem.getId(), "name", offerItem.getName()),
                    "requestItem", Map.of("id", requestItem.getId(), "name", requestItem.getName()),
                    "offerOwner", offerItem.getCurrentOwner().getUserId(),
                    "requestOwner", requestItem.getCurrentOwner().getUserId());
            String message = MAPPER.writeValueAsString(event);

            if (snsTopicArn != null && !snsTopicArn.isBlank()) {
                publishToSns(message);
            } else {
                log.info("SNS not configured — swap event (local only): {}", message);
            }
        } catch (Exception e) {
            // Never let notification failure break a completed swap
            log.error("Failed to publish swap event: {}", e.getMessage());
        }
    }

    private void publishToSns(String message) {
        try {
            // Load SnsClient via reflection so the AWS SDK jar is truly optional
            // at compile time. When deployed to AWS with TOYSWAP_SNS_TOPIC_ARN set,
            // the SDK jar must be on the classpath.
            Class<?> snsClientClass = Class.forName("software.amazon.awssdk.services.sns.SnsClient");
            Object snsClient = snsClientClass.getMethod("create").invoke(null);

            Class<?> requestClass = Class.forName("software.amazon.awssdk.services.sns.model.PublishRequest");
            Object request = requestClass.getMethod("builder").invoke(null);
            request.getClass().getMethod("topicArn", String.class).invoke(request, snsTopicArn);
            request.getClass().getMethod("message", String.class).invoke(request, message);
            Object builtRequest = request.getClass().getMethod("build").invoke(request);

            Object response = snsClient.getClass()
                    .getMethod("publish", builtRequest.getClass())
                    .invoke(snsClient, builtRequest);

            String messageId = (String) response.getClass().getMethod("messageId").invoke(response);
            log.info("Swap event published to SNS. MessageId: {}", messageId);
        } catch (ClassNotFoundException e) {
            log.warn("AWS SNS SDK not on classpath. Add software.amazon.awssdk:sns to dependencies.");
        } catch (Exception e) {
            log.error("Failed to publish to SNS topic {}: {}", snsTopicArn, e.getMessage());
        }
    }
}
