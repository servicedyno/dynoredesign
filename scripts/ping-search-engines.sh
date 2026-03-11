#!/bin/bash
# ─────────────────────────────────────────────────────────────
# DynoPay — Notify Search Engines After Deployment
# 
# Google: No ping needed — Google Search Console re-crawls
#         the submitted sitemap automatically. ✓
#
# Bing/Yandex/Seznam/Naver: Use IndexNow protocol.
#         Run:  bash scripts/ping-search-engines.sh
# ─────────────────────────────────────────────────────────────

SITE_URL="https://dynopay.com"
INDEXNOW_KEY_FILE="/app/public/indexnow-key.txt"

# ── Read the IndexNow key ──
if [ ! -f "$INDEXNOW_KEY_FILE" ]; then
  echo "Error: IndexNow key file not found at $INDEXNOW_KEY_FILE"
  echo "Generate one at https://www.indexnow.org/getstarted and place it in /app/public/"
  exit 1
fi

INDEXNOW_KEY=$(cat "$INDEXNOW_KEY_FILE" | tr -d '[:space:]')

echo "Notifying search engines via IndexNow..."
echo "Key: ${INDEXNOW_KEY:0:8}..."
echo ""

# ── Public pages to submit ──
PAGES=(
  "/"
  "/fees"
  "/documentation"
  "/system-status"
  "/terms-conditions"
  "/privacy-policy"
  "/aml-policy"
)

# ── Submit all pages in one batch via IndexNow API ──
URL_LIST=""
for page in "${PAGES[@]}"; do
  URL_LIST="${URL_LIST}\"${SITE_URL}${page}\","
done
URL_LIST="[${URL_LIST%,}]"  # Remove trailing comma, wrap in array

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json" \
  -d "{
    \"host\": \"dynopay.com\",
    \"key\": \"${INDEXNOW_KEY}\",
    \"keyLocation\": \"${SITE_URL}/${INDEXNOW_KEY}.txt\",
    \"urlList\": ${URL_LIST}
  }")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "202" ]; then
  echo "✓ IndexNow: ${#PAGES[@]} URLs submitted successfully (HTTP $HTTP_CODE)"
  echo "  Bing, Yandex, Seznam, and Naver will re-crawl within minutes."
else
  echo "✗ IndexNow: Failed (HTTP $HTTP_CODE)"
  echo "  Check your key at: ${SITE_URL}/${INDEXNOW_KEY}.txt"
fi

echo ""
echo "── Google ──"
echo "✓ No ping required. Google Search Console re-crawls your submitted sitemap automatically."
echo ""
echo "Done."
