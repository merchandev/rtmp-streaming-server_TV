document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const controls = document.getElementById('controls');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const volumeBtn = document.getElementById('muteBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const reloadBtn = document.getElementById('reloadBtn');
    const qualityBtn = document.getElementById('qualityBtn');
    const qualityMenu = document.getElementById('qualityMenu');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let hls;

    // HLS Source URL - Use relative path for production
    // The previous Nginx Config sets up /hls/stream_name.m3u8 (master playlist)
    // The user will stream to key "mystream" for example.
    // We'll try to detect the stream name or default to 'test'.
    // Important: In a real app this might be dynamic. We will assume 'live' application and 'test' key or generic master.
    // Based on nginx.conf: `http://localhost/hls/$name.m3u8` is NOT directly automatic unless we know $name.
    // BUT! Nginx RTMP with HLS enabled usually generates the m3u8 at /tmp/hls/$name.m3u8
    // We need a stable URL. If we stream to key "stream", output is "stream.m3u8".
    // We will hardcode to look for 'stream.m3u8' by default, or ask user to provide key. 
    // For this template, we'll set it to 'stream.m3u8'. User needs to stream with key 'stream'.
    const streamKey = 'stream';
    const source = `/hls/${streamKey}.m3u8`;

    // Initialize HLS
    if (Hls.isSupported()) {
        hls = new Hls({
            capLevelToPlayerSize: true, // Auto quality selection optimization
        });

        hls.loadSource(source);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
            console.log("Manifest parsed, found " + data.levels.length + " quality levels");
            generateQualityLevels(data.levels);
            loadingOverlay.classList.remove('visible');
        });

        hls.on(Hls.Events.ERROR, function (event, data) {
            console.warn("HLS Error:", data);
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log("fatal network error encountered, allow user to retry");
                        showLoading(true);
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log("fatal media error encountered, trying to recover");
                        hls.recoverMediaError();
                        break;
                    default:
                        // cannot recover
                        hls.destroy();
                        break;
                }
            }
        });

        // Listen to level switch to update UI text
        hls.on(Hls.Events.LEVEL_SWITCHED, function (event, data) {
            const level = hls.levels[data.level];
            const height = level ? level.height + 'p' : 'Auto';
            qualityBtn.innerText = hls.autoLevelEnabled ? 'Auto (' + height + ')' : height;
        });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = source;
    }

    // Controls Logic
    function togglePlay() {
        if (video.paused) {
            video.play()
                .then(() => {
                    playPauseBtn.innerHTML = '<i class="ph-fill ph-pause"></i>';
                })
                .catch(err => console.error("Play failed", err));
        } else {
            video.pause();
            playPauseBtn.innerHTML = '<i class="ph-fill ph-play"></i>';
        }
    }

    function toggleMute() {
        video.muted = !video.muted;
        updateVolumeIcon();
    }

    function updateVolumeIcon() {
        if (video.muted || video.volume === 0) {
            volumeBtn.innerHTML = '<i class="ph-fill ph-speaker-slash"></i>';
        } else if (video.volume < 0.5) {
            volumeBtn.innerHTML = '<i class="ph-fill ph-speaker-low"></i>';
        } else {
            volumeBtn.innerHTML = '<i class="ph-fill ph-speaker-high"></i>';
        }
    }

    playPauseBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay); // Click video to play/pause

    volumeBtn.addEventListener('click', toggleMute);

    volumeSlider.addEventListener('input', (e) => {
        video.volume = e.target.value;
        video.muted = false;
        updateVolumeIcon();
    });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            video.parentNode.requestFullscreen().catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    reloadBtn.addEventListener('click', () => {
        showLoading(true);
        if (hls) {
            hls.stopLoad();
            hls.detachMedia();
            hls.destroy(); // Clean reset
        }

        // Re-init logic (simplified clone)
        if (Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(source);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play();
                showLoading(false);
            });
            hls.on(Hls.Events.ERROR, (e, d) => console.log(d));
        }
    });

    // Quality Selection
    function generateQualityLevels(levels) {
        qualityMenu.innerHTML = '';

        // Add Auto Option
        const autoOpt = document.createElement('div');
        autoOpt.className = 'quality-option active';
        autoOpt.innerText = 'Auto';
        autoOpt.onclick = () => {
            hls.currentLevel = -1; // -1 is Auto
            setActiveQuality(autoOpt);
            qualityBtn.innerText = 'Auto';
            qualityMenu.classList.add('hidden');
        };
        qualityMenu.appendChild(autoOpt);

        levels.forEach((level, index) => {
            const opt = document.createElement('div');
            opt.className = 'quality-option';
            opt.innerText = level.height + 'p';
            opt.onclick = () => {
                hls.currentLevel = index;
                setActiveQuality(opt);
                qualityBtn.innerText = level.height + 'p';
                qualityMenu.classList.add('hidden');
            };
            qualityMenu.appendChild(opt);
        });
    }

    function setActiveQuality(element) {
        document.querySelectorAll('.quality-option').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
    }

    qualityBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        qualityMenu.classList.toggle('hidden');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!qualityBtn.contains(e.target) && !qualityMenu.contains(e.target)) {
            qualityMenu.classList.add('hidden');
        }
    });

    // Handle idle mouse to hide controls
    let idleTimeout;
    const wrapper = document.querySelector('.player-wrapper');
    wrapper.addEventListener('mousemove', () => {
        controls.classList.remove('hide');
        clearTimeout(idleTimeout);
        idleTimeout = setTimeout(() => {
            if (!video.paused) {
                controls.classList.add('hide');
            }
        }, 3000);
    });

    function showLoading(show) {
        if (show) loadingOverlay.classList.add('visible');
        else loadingOverlay.classList.remove('visible');
    }

    // Auto-hide controls initially if playing
    video.addEventListener('play', () => {
        playPauseBtn.innerHTML = '<i class="ph-fill ph-pause"></i>';
        idleTimeout = setTimeout(() => {
            controls.classList.add('hide');
        }, 3000);
    });

    video.addEventListener('pause', () => {
        playPauseBtn.innerHTML = '<i class="ph-fill ph-play"></i>';
        controls.classList.remove('hide');
        clearTimeout(idleTimeout);
    });
});
