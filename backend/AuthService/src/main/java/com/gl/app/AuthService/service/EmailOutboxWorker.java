package com.gl.app.AuthService.service;

import com.gl.app.AuthService.repository.EmailOutboxRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

@Service
public class EmailOutboxWorker {

    private static final Logger logger = LoggerFactory.getLogger(EmailOutboxWorker.class);

    private final EmailOutboxRepository outboxRepository;
    private final JavaMailSender mailSender;

    @Autowired
    public EmailOutboxWorker(EmailOutboxRepository outboxRepository, JavaMailSender mailSender) {
        this.outboxRepository = outboxRepository;
        this.mailSender = mailSender;
    }

    // Runs every 5 seconds to pick up pending outbox items
    @Scheduled(fixedDelayString = "5000")
    public void processOutbox() {
        List<Long> claimedIds = outboxRepository.claimBatch(10);
        
        for (Long id : claimedIds) {
            tryDispatch(id);
        }
    }

    // Called by the fast-path listener
    public void tryDispatchFastPath(Long outboxId) {
        int updated = outboxRepository.tryClaimFastPath(outboxId);
        if (updated == 1) {
            tryDispatch(outboxId);
        }
    }

    private void tryDispatch(Long outboxId) {
        outboxRepository.findById(outboxId).ifPresent(entity -> {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(entity.getRecipient());
                message.setSubject(entity.getSubject());
                message.setText(entity.getBody());
                message.setFrom("your-email@gmail.com"); // Usually configured via properties
                
                mailSender.send(message);
                
                outboxRepository.markAsSent(outboxId, "SENT");
            } catch (Exception e) {
                logger.error("Failed to send outbox email id: " + outboxId, e);
                handleFailure(outboxId, e.getMessage());
            }
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleFailure(Long outboxId, String error) {
        outboxRepository.findById(outboxId).ifPresent(entity -> {
            entity.setStatus("PENDING");
            entity.setProcessingAt(null);
            entity.setLastError(error);
            entity.setRetryCount(entity.getRetryCount() + 1);
            
            // Exponential backoff or immediate retry (for simplicity: now + retryCount mins)
            // But if it's from fast-path, we might want immediate retry.
            // Let's just set it to now() so it gets retried soon, or backoff
            entity.setNextAttemptAt(java.time.LocalDateTime.now().plusSeconds((long) Math.pow(2, entity.getRetryCount())));
            
            outboxRepository.save(entity);
        });
    }

    @Scheduled(fixedRateString = "60000")
    public void recoverStuckRows() {
        int recovered = outboxRepository.resetStuckProcessingRows();
        if (recovered > 0) {
            logger.info("Recovered {} stuck outbox rows", recovered);
        }
    }
}
