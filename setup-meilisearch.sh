#!/bin/bash
echo "=============================================="
echo "  Habition Meilisearch Setup Script (Mac/Linux)"
echo "=============================================="
echo ""

mkdir -p meilisearch
cd meilisearch

echo "Downloading Meilisearch..."

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     URL="https://github.com/meilisearch/meilisearch/releases/download/v1.12.0/meilisearch-linux-amd64";;
    Darwin*)    URL="https://github.com/meilisearch/meilisearch/releases/download/v1.12.0/meilisearch-macos-amd64";;
    *)          echo "Unsupported OS for automatic download. Please download manually."; exit 1;;
esac

curl -L "$URL" -o meilisearch
chmod +x meilisearch

if [ -f "meilisearch" ]; then
    echo ""
    echo "Download successful!"
    echo "To start Meilisearch, open a terminal in the 'meilisearch' folder and run:"
    echo "./meilisearch --master-key SBRmZ0tKs_Y1i3gQgH1aIZ6YI0LRojaqjSCI2yjUD-8"
else
    echo ""
    echo "Download failed. Please download it manually from https://github.com/meilisearch/meilisearch/releases"
fi
