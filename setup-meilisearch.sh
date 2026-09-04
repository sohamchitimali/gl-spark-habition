#!/bin/bash
echo "=============================================="
echo "  Habition Meilisearch Setup Script (Mac/Linux)"
echo "=============================================="
echo ""

mkdir -p meilisearch
cd meilisearch

echo "Downloading the latest version of Meilisearch..."

# Attempt download via official Meilisearch installer (resolves latest version for OS and architecture)
if curl -sSSL https://install.meilisearch.com | sh; then
    echo "Successfully downloaded via Meilisearch official installer."
else
    echo "Installer script unavailable, falling back to latest GitHub release redirect..."
    OS="$(uname -s)"
    ARCH="$(uname -m)"
    case "${OS}" in
        Linux*)
            if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
                URL="https://github.com/meilisearch/meilisearch/releases/latest/download/meilisearch-linux-aarch64"
            else
                URL="https://github.com/meilisearch/meilisearch/releases/latest/download/meilisearch-linux-amd64"
            fi
            ;;
        Darwin*)
            if [ "$ARCH" = "arm64" ]; then
                URL="https://github.com/meilisearch/meilisearch/releases/latest/download/meilisearch-macos-apple-silicon"
            else
                URL="https://github.com/meilisearch/meilisearch/releases/latest/download/meilisearch-macos-amd64"
            fi
            ;;
        *)          echo "Unsupported OS for automatic download. Please download manually from https://github.com/meilisearch/meilisearch/releases"; exit 1;;
    esac

    curl -L "$URL" -o meilisearch
fi

if [ -f "meilisearch" ]; then
    chmod +x meilisearch
    echo ""
    echo "Download successful!"
    echo "To start Meilisearch, open a terminal in the 'meilisearch' folder and run:"
    echo "./meilisearch --master-key SBRmZ0tKs_Y1i3gQgH1aIZ6YI0LRojaqjSCI2yjUD-8"
else
    echo ""
    echo "Download failed. Please download it manually from https://github.com/meilisearch/meilisearch/releases"
fi
