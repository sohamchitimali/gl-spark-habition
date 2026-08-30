package com.gl.app.NotificationService.controller;

import com.gl.app.NotificationService.repository.NotificationScheduleRepository;
import com.gl.app.NotificationService.service.NotificationScheduleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Base64;

/**
 * Handles email unsubscription per RFC 8058.
 *
 * GET  /notifications/unsubscribe — Confirmation page shown to the user before they unsubscribe.
 * POST /notifications/unsubscribe — The actual unsubscribe action (triggered by email client one-click or the confirmation page form).
 *
 * The unsubscribe URL in every email is: {app.base-url}/notifications/unsubscribe?userId={userId}&token={token}
 */
@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@Slf4j
public class UnsubscribeController {

    private final NotificationScheduleService scheduleService;
    private final RestTemplate restTemplate;

    @Value("${auth.service.url:http://localhost:8080}")
    private String authServiceUrl;

    @Value("${app.base-url:http://localhost:8081}")
    private String baseUrl;

    /**
     * GET confirmation page (RFC 8058 Step 1).
     * The user clicks the unsubscribe link in their email client and sees this page.
     * Returns a simple HTML form with a single "Confirm Unsubscribe" button.
     */
    @GetMapping(value = "/unsubscribe", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> unsubscribeConfirmationPage(
            @RequestParam("userId") String userId,
            @RequestParam("token") String token) {

        String html = """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Unsubscribe — Habition</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                               display: flex; align-items: center; justify-content: center;
                               min-height: 100vh; margin: 0; background: #0f0f14; color: #e0e0e0; }
                        .card { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 16px;
                                padding: 40px; max-width: 420px; text-align: center; }
                        h1 { font-size: 1.5rem; margin-bottom: 8px; }
                        p { color: #a0a0b0; margin-bottom: 24px; }
                        button { background: #e03e3e; color: white; border: none; padding: 12px 32px;
                                 border-radius: 8px; font-size: 1rem; cursor: pointer; }
                        button:hover { background: #c03030; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Unsubscribe from Habition Emails?</h1>
                        <p>You'll no longer receive daily habit reminders. You can re-enable this anytime from your profile settings.</p>
                        <form method="POST" action="%s/notifications/unsubscribe">
                            <input type="hidden" name="userId" value="%s"/>
                            <input type="hidden" name="token" value="%s"/>
                            <button type="submit">Confirm Unsubscribe</button>
                        </form>
                    </div>
                </body>
                </html>
                """.formatted(baseUrl, userId, token);

        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }

    /**
     * POST unsubscribe action (RFC 8058 Step 2).
     * Called either by the confirmation form or directly by a one-click email client.
     * Validates the token, calls AuthService to set notificationsEnabled = false,
     * and cascade-cancels the NotificationSchedule.
     */
    @PostMapping("/unsubscribe")
    public ResponseEntity<String> processUnsubscribe(
            @RequestParam("userId") String userId,
            @RequestParam("token") String token) {

        log.info("Processing unsubscribe for userId: {}", userId);

        try {
            // Token validation: verify the token matches what we'd generate for this userId
            String expectedToken = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString((userId + ":unsubscribe").getBytes());
            if (!expectedToken.equals(token)) {
                log.warn("Invalid unsubscribe token for userId {}", userId);
                return ResponseEntity.badRequest().body("Invalid unsubscribe token.");
            }

            // Disable email notifications in AuthService
            restTemplate.postForEntity(
                    authServiceUrl + "/auth/users/" + userId + "/unsubscribe",
                    null, Void.class
            );

            // Cascade-cancel the notification schedule
            scheduleService.cancelScheduleForUser(userId);

            return ResponseEntity.ok("""
                    <html><body style="font-family:sans-serif;text-align:center;padding:60px">
                    <h2>You've been unsubscribed.</h2>
                    <p>You won't receive any more habit reminders from Habition.</p>
                    <p>You can re-enable emails anytime from your <a href="%s/profile">profile settings</a>.</p>
                    </body></html>
                    """.formatted(baseUrl.replace(":8081", ":5173")));
        } catch (Exception e) {
            log.error("Failed to process unsubscribe for userId {}", userId, e);
            return ResponseEntity.internalServerError()
                    .body("Failed to process your unsubscribe request. Please try again.");
        }
    }
}

