#!/bin/sh
# Run by the nginx image before it starts: forward /api to API_UPSTREAM when it is set, otherwise serve only the site
# (the build then calls the API at VITE_API_URL).
set -eu
target=/etc/nginx/agrisage/api-proxy.conf
if [ -n "${API_UPSTREAM:-}" ]; then
  envsubst '${API_UPSTREAM}' < /etc/nginx/agrisage/api-proxy.conf.template > "$target"
  echo "agrisage: /api is forwarded to ${API_UPSTREAM}"
else
  : > "$target"
  echo "agrisage: API_UPSTREAM is empty, /api is not forwarded"
fi
