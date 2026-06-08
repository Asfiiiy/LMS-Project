#!/usr/bin/env bash
# Diagnose login hanging behind Nginx: backend vs proxy.
# Run on the app server: bash scripts/diagnose-login-proxy.sh

set -e
echo "=== 1) Backend directly (bypasses Nginx) — should respond in < 2s ==="
curl -sS -w "\nHTTP %{http_code} total_time=%{time_total}s\n" -o /tmp/login-body.json \
  -X POST "http://127.0.0.1:5000/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent-check@example.com","password":"x"}' || true
head -c 200 /tmp/login-body.json 2>/dev/null || true
echo ""

echo "=== 2) Through Nginx on localhost (if server_name default / lms) ==="
curl -sS -w "\nHTTP %{http_code} total_time=%{time_total}s\n" -o /tmp/login-nginx.json \
  -X POST "https://127.0.0.1/api/login" \
  -H "Content-Type: application/json" \
  -H "Host: lms.inspirelondoncollege.com" \
  -k \
  -d '{"email":"nonexistent-check@example.com","password":"x"}' 2>/dev/null || echo "(skip if no local HTTPS)"

echo "=== 3) Nginx error log (needs sudo) — upstream timeout / connect refused ==="
sudo tail -40 /var/log/nginx/error.log 2>/dev/null || echo "  sudo tail -40 /var/log/nginx/error.log"

echo "=== 4) Recent /api/login in access log ==="
sudo grep "POST /api/login" /var/log/nginx/access.log 2>/dev/null | tail -8 || true

echo ""
echo "Hints:"
echo "  - If (1) is slow: backend/Redis/MySQL — check: pm2 logs lms-backend"
echo "  - If (1) fast but browser slow: Nginx must proxy /api to 127.0.0.1:5000"
echo "  - error.log 'upstream timed out' → raise proxy_connect_timeout / fix backend listen"
