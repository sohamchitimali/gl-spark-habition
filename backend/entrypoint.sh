#!/bin/sh
set -e

echo "=================================================="
echo " Starting Habition Unified Service (Rust + Meili) "
echo " Memory budget: ~55MB (fits Render 512MB tier)    "
echo "=================================================="

# Start internal-only Meilisearch on 127.0.0.1:7700 if enabled
if [ "${ENABLE_MEILISEARCH:-true}" != "false" ] && [ "${ENABLE_MEILISEARCH:-true}" != "0" ] && [ "${ENABLE_MEILISEARCH:-true}" != "no" ]; then
    echo "Starting internal Meilisearch on 127.0.0.1:7700..."
    mkdir -p /app/data.ms
    /usr/local/bin/meilisearch \
        --http-addr 127.0.0.1:7700 \
        --db-path /app/data.ms \
        --no-analytics \
        ${MEILISEARCH_MASTER_KEY:+--master-key "$MEILISEARCH_MASTER_KEY"} &
    MEILI_PID=$!
    echo "Internal Meilisearch daemon started (PID: $MEILI_PID)."
else
    echo "Internal Meilisearch is disabled; PostgreSQL search engine active."
fi

# Hand off execution to the Rust backend
exec /usr/local/bin/habition-backend
