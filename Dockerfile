FROM alpine:latest

# Instalar Nginx, módulo RTMP y FFmpeg
# openssl ELIMINADO — Traefik gestiona los certificados SSL
RUN apk add --no-cache \
    nginx \
    nginx-mod-rtmp \
    ffmpeg

# Crear directorio para fragmentos HLS
RUN mkdir -p /usr/share/nginx/html/hls && \
    chmod -R 777 /usr/share/nginx/html/hls

# Logs hacia stdout/stderr del contenedor Docker
RUN ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log

# Copiar configuración de Nginx
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copiar el player web
COPY web /usr/share/nginx/html

# ELIMINADO: COPY ssl /etc/nginx/ssl
# Traefik maneja el SSL externamente — no necesitamos certs dentro del contenedor

# Copiar entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Exponer RTMP (para OBS) y HTTP interno (para Traefik)
EXPOSE 1935 80

ENTRYPOINT ["/entrypoint.sh"]
