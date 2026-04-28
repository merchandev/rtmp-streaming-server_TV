document.addEventListener('DOMContentLoaded', async () => {
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
    let source = null;
    let activeStreamKey = null;
    let retryTimer = null;
    const retryDelayMs = 5000;

    // --- AUTO DETECT STREAM KEY ---
    const urlParams = new URLSearchParams(window.location.search);
    const requestedStreamKey = urlParams.get('s');

    // Debug removed for production
    // const statusElement = ... 

    async function getActiveStreamKey() {
        if (requestedStreamKey !== null && requestedStreamKey !== undefined) {
            // Allow empty query parameters (/?s=) to fall back to default behavior
            return requestedStreamKey;
        }

        try {
            console.log("Scanning for active streams...");
            const response = await fetch('/stat');
            const text = await response.text();

            // Regex now matches <stream> ... (any content) ... <name>KEY</name>
            // [\s\S]*? matches any character including newlines, non-greedy
            const match = text.match(/<application\s+name="live">[\s\S]*?<stream>[\s\S]*?<name>([^<]*)<\/name>/);

            if (match && match[1] !== undefined) {
                const foundKey = match[1];
                console.log("Auto-detected stream:", foundKey === '' ? '<empty>' : foundKey);
                return foundKey; // can be empty string when publisher uses no key
            }

            // Fallback: Try simpler regex in case application tag structure differs
            const simpleMatch = text.match(/<stream>[\s\S]*?<name>([^<]*)<\/name>/);
            if (simpleMatch && simpleMatch[1] !== undefined) {
                const foundKey = simpleMatch[1];
                console.log("Auto-detected stream (simple match):", foundKey === '' ? '<empty>' : foundKey);
                return foundKey;
            }

            // Fallback: consider empty stream key if .m3u8 exists for empty name
            const testDefault = await fetch('/hls/.m3u8', { method: 'HEAD' });
            if (testDefault.ok) {
                console.log("Detected HLS stream with empty key at /hls/.m3u8");
                return '';
            }

        } catch (e) {
            console.error("Auto-detect failed:", e);
        }
        return null;
    }

    function buildSource(streamKey) {
        return `/hls/${encodeURIComponent(streamKey)}.m3u8`;
    }

    function clearRetryTimer() {
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
    }

    function scheduleRetry() {
        if (requestedStreamKey || retryTimer) return;

        retryTimer = setTimeout(async () => {
            retryTimer = null;
            await loadSelectedStream();
        }, retryDelayMs);
    }

    function destroyPlayer() {
        if (hls) {
            hls.stopLoad();
            hls.detachMedia();
            hls.destroy();
            hls = null;
        }

        video.removeAttribute('src');
        video.load();
    }

    function handleManifestParsed(data) {
        console.log("Manifest parsed, found " + data.levels.length + " quality levels");
        clearRetryTimer();
        showLoading(false);
        generateQualityLevels(data.levels);
        video.play().catch(e => console.log("Auto-play prevented:", e));
    }

    function loadNativeSource() {
        video.src = source;
        video.addEventListener('loadedmetadata', () => {
            showLoading(false);
            video.play().catch(err => console.error("Play failed", err));
        }, { once: true });
    }

    function bindHlsPlayer() {
        hls = new Hls({
            capLevelToPlayerSize: true,
        });

        hls.loadSource(source);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
            handleManifestParsed(data);
        });

        hls.on(Hls.Events.ERROR, async function (event, data) {
            console.warn("HLS Error:", data);

            if (!data.fatal) return;

            showLoading(true);

            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    if (requestedStreamKey) {
                        console.log("fatal network error encountered, allow user to retry");
                        hls.startLoad();
                    } else {
                        console.log("No active manifest available yet, rescanning stream list...");
                        await loadSelectedStream(true);
                        scheduleRetry();
                    }
                    break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log("fatal media error encountered, trying to recover");
                    hls.recoverMediaError();
                    break;
                default:
                    destroyPlayer();
                    scheduleRetry();
                    break;
            }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, function (event, data) {
            const level = hls.levels[data.level];
            const height = level ? level.height + 'p' : 'Auto';
            qualityBtn.innerText = hls.autoLevelEnabled ? 'Auto (' + height + ')' : height;
        });
    }

    async function loadSelectedStream(forceReload = false) {
        const streamKey = await getActiveStreamKey();

        // streamKey may be empty string when publisher does not provide key
        if (streamKey === null || streamKey === undefined) {
            console.log("No active stream detected yet.");
            showLoading(true);
            destroyPlayer();
            scheduleRetry();
            return;
        }

        if (!forceReload && activeStreamKey === streamKey && source) {
            console.log("Playing:", streamKey);
            return;
        }

        activeStreamKey = streamKey;
        source = buildSource(streamKey);
        clearRetryTimer();
        showLoading(true);
        destroyPlayer();
        console.log("Playing:", streamKey);

        if (Hls.isSupported()) {
            bindHlsPlayer();
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            loadNativeSource();
        }
    }

    await loadSelectedStream();

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
        loadSelectedStream(true).catch(err => console.error("Reload failed", err));
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
