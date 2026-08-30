package com.gl.app.NotificationService.worker;

import com.gl.app.NotificationService.entity.NotificationDelivery;
import com.gl.app.NotificationService.repository.NotificationDeliveryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import jakarta.mail.internet.MimeMessage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;

@Component
@RequiredArgsConstructor
@Slf4j
public class EmailDeliveryWorker {

    private final NotificationDeliveryRepository deliveryRepository;
    private final JavaMailSender mailSender;
    private final ObjectMapper objectMapper;

    @Scheduled(fixedDelayString = "${delivery.worker.delay:5000}")
    public void processPendingDeliveries() {
        List<NotificationDelivery> batch = claimBatch();

        if (batch.isEmpty()) {
            return;
        }

        for (NotificationDelivery delivery : batch) {
            try {
                processSingle(delivery);
            } catch (Exception e) {
                log.error("Failed to deliver notification {}", delivery.getId(), e);
                handleFailure(delivery, e.getMessage());
            }
        }
    }

    @Transactional
    public List<NotificationDelivery> claimBatch() {
        List<NotificationDelivery> pending = deliveryRepository.findPendingForDelivery(20);
        for (NotificationDelivery delivery : pending) {
            delivery.setStatus("SENDING");
        }
        return deliveryRepository.saveAll(pending);
    }

    private void processSingle(NotificationDelivery delivery) throws Exception {
        log.info("Sending email with payload: {}", delivery.getPayload());
        
        JsonNode payload = objectMapper.readTree(delivery.getPayload());
        String to = payload.get("to").asText();
        String subject = payload.get("subject").asText();
        String body = payload.get("body").asText();
        
        MimeMessage message = mailSender.createMimeMessage();
        // Use true for multipart and "UTF-8" to ensure emojis render correctly
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(body, true); // body is already fully-formed HTML
        
        // Add inline image using CID with explicit content type
        ClassPathResource logoResource = new ClassPathResource("habition_logo_green.png");
        helper.addInline("habition-logo", logoResource, "image/png");
        
        mailSender.send(message);
        log.info("Email sent successfully to {}", to);

        markAsProcessed(delivery);
    }

    @Transactional
    public void markAsProcessed(NotificationDelivery delivery) {
        delivery.setStatus("PROCESSED");
        delivery.setProcessedAt(LocalDateTime.now());
        deliveryRepository.save(delivery);
    }

    @Transactional
    public void handleFailure(NotificationDelivery delivery, String error) {
        delivery.setLastError(error);
        if (delivery.getRetryCount() < 3) {
            delivery.setRetryCount(delivery.getRetryCount() + 1);
            delivery.setNextRetryAt(LocalDateTime.now().plusMinutes((long) Math.pow(5, delivery.getRetryCount())));
            delivery.setStatus("FAILED");
        } else {
            delivery.setStatus("CANCELLED");
        }
        deliveryRepository.save(delivery);
    }

    // Stuck claim recovery
    @Scheduled(fixedRateString = "${delivery.worker.recovery.rate:600000}")
    @Transactional
    public void recoverStuckClaims() {
        List<NotificationDelivery> stuck = deliveryRepository.findStuckSending();
        for (NotificationDelivery d : stuck) {
            d.setStatus("PENDING_SEND");
        }
        deliveryRepository.saveAll(stuck);
        if (!stuck.isEmpty()) {
            log.warn("Recovered {} stuck deliveries", stuck.size());
        }
    }
}

