# ==============================================================================
# Habition Rust Unified Backend Dockerfile
# Ultra-lean runtime (<40MB image, <30MB RAM footprint)
# Designed for Render Free Tier (512MB RAM), Fly.io, Railway, VPS
# ==============================================================================

# Stage 1: Build Rust binary
FROM rust:1.85-slim-bookworm AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy crate files
COPY Cargo.toml Cargo.lock ./
COPY src ./src

# Build stripped release binary
RUN cargo build --release && strip target/release/habition-backend

# Stage 2: Minimal runtime container
FROM debian:bookworm-slim
WORKDIR /app

# Install runtime dependencies (ca-certificates for HTTPS/TLS, curl for health checks, tzdata for timezones)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl tzdata && rm -rf /var/lib/apt/lists/*

# Copy release binary from builder
COPY --from=builder /app/target/release/habition-backend /usr/local/bin/habition-backend

# Default port
EXPOSE 8080
ENV PORT=8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["habition-backend"]
