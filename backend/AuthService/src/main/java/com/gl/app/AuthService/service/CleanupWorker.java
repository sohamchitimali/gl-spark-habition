package com.gl.app.AuthService.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Service
public class CleanupWorker {

    private static final Logger logger = LoggerFactory.getLogger(CleanupWorker.class);

    @PersistenceContext
    private EntityManager entityManager;

    // Run every day at 3 AM
    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional
    public void cleanupOldData() {
        logger.info("Starting cleanup of old OTPs and outbox items...");
        
        int deletedOtps = entityManager.createNativeQuery(
                "DELETE FROM otp_entity WHERE created_at < NOW() - INTERVAL '30 days'"
        ).executeUpdate();
        
        int deletedOutbox = entityManager.createNativeQuery(
                "DELETE FROM email_outbox WHERE created_at < NOW() - INTERVAL '30 days'"
        ).executeUpdate();
        
        logger.info("Cleanup completed. Deleted {} old OTPs and {} old outbox items.", deletedOtps, deletedOutbox);
    }
}
