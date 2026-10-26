use crate::config::AppConfig;
use serde_json::json;
use tracing::{info, warn};

pub struct DigestContent {
    pub subject: String,
    pub html_body: String,
}

pub async fn compose_habit_digest(
    config: &AppConfig,
    client: &reqwest::Client,
    username: &str,
    streak: i32,
    incomplete_habits: &[String],
    completed_habits: usize,
    total_habits: usize,
    unsubscribe_url: &str,
) -> DigestContent {
    if let Some(api_key) = &config.gemini_api_key {
        let prompt = format!(
            "You are Habition's friendly AI habit coach. Write a short, motivating notification email to {}.\n\
            Current streak: {} days.\n\
            Habits completed today: {} of {}.\n\
            Remaining habits to complete today: {}.\n\
            Return your output in valid JSON format only with keys 'subject' (catchy and concise) and 'body' (in clean HTML with paragraphs and bullet points).",
            username, streak, completed_habits, total_habits, incomplete_habits.join(", ")
        );

        let url = format!("{}?key={}", config.gemini_api_url, api_key);
        let request_payload = json!({
            "contents": [{
                "parts": [{ "text": prompt }]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 800,
                "responseMimeType": "application/json"
            }
        });

        match client.post(&url).json(&request_payload).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(json_val) = resp.json::<serde_json::Value>().await {
                    if let Some(candidate_text) = json_val["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(candidate_text) {
                            if let (Some(subj), Some(body)) = (parsed["subject"].as_str(), parsed["body"].as_str()) {
                                let full_html = wrap_html(body, unsubscribe_url);
                                info!("Successfully generated AI digest via Gemini for {}", username);
                                return DigestContent {
                                    subject: subj.to_string(),
                                    html_body: full_html,
                                };
                            }
                        }
                    }
                }
            }
            Ok(resp) => {
                warn!("Gemini API responded with status {}. Falling back to rule-based engine.", resp.status());
            }
            Err(e) => {
                warn!("Failed to call Gemini API: {:?}. Falling back to rule-based engine.", e);
            }
        }
    }

    // Rule-based fallback engine
    rule_based_fallback(username, streak, incomplete_habits, completed_habits, total_habits, unsubscribe_url)
}

fn rule_based_fallback(
    username: &str,
    streak: i32,
    incomplete_habits: &[String],
    completed_habits: usize,
    total_habits: usize,
    unsubscribe_url: &str,
) -> DigestContent {
    let subject = if streak > 0 {
        format!("🔥 Keep your {}-day streak alive, {}!", streak, username)
    } else {
        format!("✨ You have {} habit{} waiting for today!", incomplete_habits.len(), if incomplete_habits.len() == 1 { "" } else { "s" })
    };

    let mut habit_items = String::new();
    for h in incomplete_habits {
        habit_items.push_str(&format!("<li style='margin-bottom: 8px;'><strong>{}</strong></li>", h));
    }

    let body = format!(
        "<p>Hi <strong>{}</strong>,</p>\
        <p>You're making great progress today! You've checked off <strong>{}/{}</strong> habits.</p>\
        <p>Here are your remaining habits to conquer before the day ends:</p>\
        <ul style='padding-left: 20px;'>{}</ul>\
        <p>Stay consistent and earn your daily bonus coins!</p>",
        username, completed_habits, total_habits, habit_items
    );

    let html_body = wrap_html(&body, unsubscribe_url);
    DigestContent { subject, html_body }
}

fn wrap_html(body: &str, unsubscribe_url: &str) -> String {
    format!(
        "<!DOCTYPE html>\
        <html>\
        <head>\
            <meta charset='utf-8'/>\
            <style>\
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f0f14; color: #f0f0f5; padding: 24px; margin: 0; }}\
                .card {{ max-width: 560px; margin: 0 auto; background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 16px; padding: 32px; }}\
                .logo {{ font-size: 24px; font-weight: bold; color: #7F77DD; margin-bottom: 20px; }}\
                .footer {{ margin-top: 32px; border-top: 1px solid #2a2a3a; padding-top: 16px; font-size: 12px; color: #888899; text-align: center; }}\
                .footer a {{ color: #7F77DD; text-decoration: none; }}\
            </style>\
        </head>\
        <body>\
            <div class='card'>\
                <div class='logo'>Habition</div>\
                {}\
                <div class='footer'>\
                    <p>Sent with care by Habition.</p>\
                    <p><a href='{}'>Unsubscribe from habit reminders</a></p>\
                </div>\
            </div>\
        </body>\
        </html>",
        body, unsubscribe_url
    )
}

