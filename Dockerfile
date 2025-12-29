FROM alpine:latest

# Install Nginx, RTMP module, and FFmpeg
RUN apk add --no-cache \
    nginx \
    nginx-mod-rtmp \
    ffmpeg \
    openssl

# Create directories for HLS fragments and playlists
# Create directories for HLS fragments in web root to simplify access
RUN mkdir -p /usr/share/nginx/html/hls && \
    chmod -R 777 /usr/share/nginx/html/hls

# Forward access and error logs to docker log collector
RUN ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log

# Copy Nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY web /usr/share/nginx/html
COPY ssl /etc/nginx/ssl

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose RTMP and HTTP ports
EXPOSE 1935 80 443

# Start Nginx via entrypoint
ENTRYPOINT ["/entrypoint.sh"]
