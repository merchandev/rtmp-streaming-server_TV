#!/bin/sh
# Ensure the HLS directory exists and is writable
mkdir -p /tmp/hls
chmod -R 777 /tmp/hls

# Ensure the Web root HLS directory exists (if we used that, but we are switching back to /tmp for performance/volatility)
# Just in case, let's clean it up or ignore it.

# Start Nginx
echo "Starting Nginx Wrapper..."
exec nginx -g "daemon off;"
