#!/bin/sh
# ==============================================================
# Entrypoint — Servidor de Streaming TV (mv-streaming)
# SSL gestionado por Traefik — este script solo prepara HLS
# ==============================================================
set -eu

HLS_DIR="${HLS_DIR:-/tmp/hls}"

# Crear directorio de HLS con permisos correctos
mkdir -p "$HLS_DIR"
chmod 777 "$HLS_DIR"

echo "=============================================="
echo " Monagas Visión — Servidor de Streaming TV"
echo " SSL/TLS: Gestionado por Traefik (externo)"
echo " HLS Dir: $HLS_DIR"
echo "=============================================="

exec nginx -g "daemon off;"
