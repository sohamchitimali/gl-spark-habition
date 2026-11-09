#!/bin/sh
set -e

echo "=================================================="
echo " Starting Habition Unified Service (Rust + Meili) "
echo " Memory budget: ~55MB (fits Render 512MB tier)    "
echo "=================================================="

# Start internal-only Meilisearch on 127.0.0.1:7700 with a 3s delay
# so Render's port detector binds public routing to habition-backend ($PORT) first
if [ "${ENABLE_MEILISEARCH:-true}" != "false" ] && [ "${ENABLE_MEILISEARCH:-true}" != "0" ] && [ "${ENABLE_MEILISEARCH:-true}" != "no" ]; then
    if [ -x /usr/local/bin/meilisearch ]; then
        (
            sleep 3
            echo "Starting internal Meilisearch daemon on 127.0.0.1:7700..."
            mkdir -p /app/data.ms
            /usr/local/bin/meilisearch \
                --http-addr 127.0.0.1:7700 \
                --db-path /app/data.ms \
                --no-analytics \
                ${MEILISEARCH_MASTER_KEY:+--master-key "$MEILISEARCH_MASTER_KEY"}
        ) &
    else
        echo "Warning: /usr/local/bin/meilisearch not found or not executable. Falling back to PostgreSQL search engine."
    fi
else
    echo "Internal Meilisearch is disabled; PostgreSQL search engine active."
fi

# Hand off execution immediately to the Rust backend
exec /usr/local/bin/habition-backend
