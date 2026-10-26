use crate::config::AppConfig;
use lettre::{
    message::header::ContentType,
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use tracing::{error, info};

pub async fn send_email(
    config: &AppConfig,
    to: &str,
    subject: &str,
    html_body: &str,
) -> Result<(), anyhow::Error> {
    if let (Some(username), Some(password)) = (&config.smtp_username, &config.smtp_password) {
        let creds = Credentials::new(username.clone(), password.clone());

        let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay(&config.smtp_host)?
            .port(config.smtp_port)
            .credentials(creds)
            .build();

        let email = Message::builder()
            .from(format!("Habition <{}>", username).parse()?)
            .to(to.parse()?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(html_body.to_string())?;

        match mailer.send(email).await {
            Ok(_) => {
                info!("Email successfully sent to {}", to);
                Ok(())
            }
            Err(e) => {
                error!("Failed to send email to {}: {:?}", to, e);
                Err(anyhow::anyhow!("SMTP send error: {}", e))
            }
        }
    } else {
        info!(
            "[DEV EMAIL MOCK] To: {} | Subject: {}\nBody: {}",
            to, subject, html_body
        );
        Ok(())
    }
}
