FROM alpine:latest

# Install Nginx, RTMP module, and FFmpeg
RUN apk add --no-cache \
    nginx \
    nginx-mod-rtmp \
    ffmpeg \
    openssl

# Create directories for HLS fragments and playlists
RUN mkdir -p /tmp/hls && \
    chmod -R 777 /tmp/hls

# Forward access and error logs to docker log collector
RUN ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log

# Copy Nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY web /usr/share/nginx/html

# Expose RTMP and HTTP ports
EXPOSE 1935 80 443

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
