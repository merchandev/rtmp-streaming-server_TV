# Professional RTMP Streaming Server Deployment Guide

This project provides a complete, professional-grade RTMP streaming server solution. It includes a Dockerized Nginx backend with FFmpeg transcoding (1080p, 720p, 480p, 360p) and a modern "Glassmorphism" web player.

## Features
- **RTMP Ingest**: Compatible with OBS, vMix, Wirecast.
- **Adaptive Bitrate Streaming (HLS)**: Auto-generates 1080p, 720p, 480p, 360p qualities.
- **Custom Web Player**: Modern, responsive, glass-effect UI with quality selector and controls.
- **Dockerized**: Easy deployment on any VPS (Hostinger, DigitalOcean, etc.).

---

## Prerequisites (Hostinger VPS)

1. **VPS Operating System**: Ubuntu 22.04 or Debian 11 recommended.
2. **Domain**: You need a domain pointing to your VPS IP (e.g., `stream.yourdomain.com`).
3. **Hardware**: At least 4GB RAM + 2 vCPUs recommended for 1080p transcoding.

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
For a professional setup, you need HTTPS. We will use Certbot.

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
Then copy the certs to the project folder:
```bash
mkdir -p ssl
cp /etc/letsencrypt/live/stream.yourdomain.com/fullchain.pem ./ssl/nginx.crt
cp /etc/letsencrypt/live/stream.yourdomain.com/privkey.pem ./ssl/nginx.key
```

### 4. Deploy the Server
Navigate to the folder and start the container:
```bash
cd rtmp-streaming-server
docker compose up -d --build
```

---

## Streaming Setup (OBS / vMix)

1. **Service**: Custom / RTMP
2. **Server**: `rtmp://your-vps-ip/live` (or your domain)
3. **Stream Key**: `stream` 
   *(Note: If you change this key, update `script.js` in the `web` folder line `const streamKey = 'stream';` to match)*

**Recommended OBS Settings**:
- **Video Bitrate**: 6000 Kbps (for 1080p)
- **Keyframe Interval**: 2s (Critical for HLS)
- **Profile**: high
- **Tune**: zerolatency

---

## Accessing the Player
Open your browser and navigate to:
`http://your-vps-ip/` or `https://stream.yourdomain.com/`

---

## Troubleshooting
- **Stream Buffering?** Transcoding is CPU intensive. If your VPS is weak, disable some transcoding variants in `nginx/nginx.conf` by removing lines starting with `exec ffmpeg`.
- **No Video?** Ensure you started streaming in OBS with the correct key (`stream`). Wait 10-15 seconds for the first HLS segments to generate.
