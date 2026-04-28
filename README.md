# Professional RTMP Streaming Server Deployment Guide

This project provides a complete RTMP streaming server solution. It includes a Dockerized Nginx backend that converts an incoming RTMP feed into HLS and a modern web player.

## Features
- **RTMP Ingest**: Compatible with OBS, vMix, Wirecast.
- **HLS Output**: Generates a live HLS playlist and `.ts` segments from the incoming RTMP feed.
- **Custom Web Player**: Modern, responsive, glass-effect UI with quality selector and controls.
- **Dockerized**: Easy deployment on any VPS (Hostinger, DigitalOcean, etc.).

---

## Prerequisites (Hostinger VPS)

1. **VPS Operating System**: Ubuntu 22.04 or Debian 11 recommended.
2. **Domain**: You need a domain pointing to your VPS IP (e.g., `stream.yourdomain.com`).
3. **Hardware**: At least 2GB RAM + 1 vCPU recommended for a single live feed.

---

## Installation Steps

### 1. Install Docker & Docker Compose
Connect to your VPS via SSH and run:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose Plugin
sudo apt install docker-compose-plugin -y
```

### 2. Upload Project Files
Upload the `rtmp-streaming-server` folder to your VPS (e.g., using FileZilla or SCP).
```bash
# Example if using SCP from your local machine
scp -r ./rtmp-streaming-server root@your-vps-ip:/root/
```

### 3. Generate SSL Certificates
For a professional setup, you need HTTPS. The container now supports two modes:

- Place certificate files in `ssl/nginx.crt` and `ssl/nginx.key`
- Or mount Let's Encrypt from the host at `/etc/letsencrypt` and set `SSL_DOMAIN`

**Option A: Quick Self-Signed (For Testing Only)**
```bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ssl/nginx.key -out ssl/nginx.crt -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

**Option B: Real SSL with Let's Encrypt (Production)**
Stop any running web server first.
```bash
sudo apt install certbot -y
sudo certbot certonly --standalone -d stream.yourdomain.com
```
Then either copy the certs to the project folder:
```bash
mkdir -p ssl
cp /etc/letsencrypt/live/stream.yourdomain.com/fullchain.pem ./ssl/nginx.crt
cp /etc/letsencrypt/live/stream.yourdomain.com/privkey.pem ./ssl/nginx.key
```
Or keep them in `/etc/letsencrypt` and update `SSL_DOMAIN` in `docker-compose.yml`.

### 4. Deploy the Server
Navigate to the folder and start the container:
```bash
cd rtmp-streaming-server
docker compose up -d --build
```

On Hostinger Docker Manager, avoid bind-mounting single files from the repository into the container. This project bakes `nginx.conf`, `web/` and `ssl/` into the image during `docker build`, and only keeps runtime storage for HLS plus the optional Let's Encrypt directory mount.

---

## Streaming Setup (OBS / vMix)

1. **Service**: Custom / RTMP
2. **Server**: `rtmp://your-vps-ip/live` (or your domain)
3. **Stream Key**: `mistream`
   *(If your encoder leaves the stream key empty, the server now republishes the feed internally as `mistream` so the playback URL stays `/?s=mistream` and the HLS manifest stays `/hls/mistream.m3u8`.)*

**Recommended OBS / vMix settings**:
- **Server**: `rtmp://tv.monagasvision.com/live` (o `rtmp://<tu-ip>/live`)
- **Stream Key**: `mistream` (se recomienda fija)
- **Video Bitrate**: 6000 Kbps (para 1080p)
- **Keyframe Interval**: 2s (Crítico para HLS)
- **Profile**: high
- **Tune**: zerolatency

> Importante: si la clave de stream está vacía, Nginx publica como `name=''` y la playlist HLS se genera en `/tmp/hls/.m3u8`. Para evitar errores 404, usa siempre una clave no vacía.

---

## Accessing the Player
Open your browser and navigate to:
`http://your-vps-ip/` or `https://stream.yourdomain.com/`

---

## Troubleshooting
- **Hostinger deploy fails with `not a directory` while mounting `nginx.conf`?** That happens when the platform resolves a file bind mount as a directory. This compose file now avoids mounting repo files at runtime and uses the image contents instead.
- **The logs show `publish: name=''`?** Your encoder connected to the `live` application without a stream key. This setup now relays that input to the fixed playback stream `mistream`, but the clean encoder configuration is still `rtmp://your-domain/live` with stream key `mistream`.
- **Playback stalls?** Verify the publisher is still connected to `rtmp://your-domain/live/<key>` and that the HLS files are being created in `/tmp/hls/`.
- **`/hls/<key>.m3u8` returns 404?** That means Nginx did not find the playlist in `/tmp/hls/`. In practice this happens when nobody is publishing to `rtmp://your-domain/live/<key>` or the stream key requested by the player does not match the key sent by OBS.
- **SSL warning in the browser?** If you are using the bundled certificate, it is only valid for local testing. For production, use a real certificate for your domain and confirm the container is loading it from Let's Encrypt or from `ssl/nginx.crt` and `ssl/nginx.key`.
