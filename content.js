let originalSpeed = null;
let smoothSeekEndTime = 0;

let userSettings = { masterEnable: true, uiPosition: 15, uiOpacity: 1.0, enableNico: false };
let settingsLoaded = false;

function updateUIPosition() {
  const container = document.getElementById('ypc-container');
  const video = document.querySelector('video');
  if (!container || !video) return;

  let playerContainer = video.parentElement;
  if (window.location.hostname.includes('youtube.com')) {
    playerContainer = document.querySelector('.html5-video-player');
  }

  if (playerContainer) {
    const playerHeight = playerContainer.clientHeight;
    const uiHeight = container.offsetHeight || 50; 
    
    const minBottom = 60; 
    const maxBottom = Math.max(minBottom, playerHeight - uiHeight - 10);

    const posVal = Math.max(0, Math.min(100, userSettings.uiPosition));
    const targetPx = minBottom + (maxBottom - minBottom) * (posVal / 100);

    container.style.bottom = `${targetPx}px`;
  }
}

// ★ local.get に変更
chrome.storage.local.get({ masterEnable: true, uiPosition: 15, uiOpacity: 1.0, enableNico: false }, (items) => {
  userSettings = items;
  settingsLoaded = true;
  document.documentElement.style.setProperty('--ypc-hover-opacity', userSettings.uiOpacity);
  if (!userSettings.masterEnable) removePlayerUI();
  else updateUIPosition();
});

// ★ area === 'local' に変更
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.masterEnable) {
      userSettings.masterEnable = changes.masterEnable.newValue;
      if (!userSettings.masterEnable) removePlayerUI();
      else injectPlayerUI();
    }
    if (changes.uiPosition) {
      userSettings.uiPosition = changes.uiPosition.newValue;
      updateUIPosition();
    }
    if (changes.uiOpacity) {
      userSettings.uiOpacity = changes.uiOpacity.newValue;
      document.documentElement.style.setProperty('--ypc-hover-opacity', userSettings.uiOpacity);
    }
    if (changes.enableNico) {
      userSettings.enableNico = changes.enableNico.newValue;
      if (!userSettings.enableNico && window.location.hostname.includes('nicovideo.jp')) {
        removePlayerUI();
      } else if (userSettings.enableNico) {
        injectPlayerUI();
      }
    }
  }
});

function removePlayerUI() {
  const existingContainer = document.getElementById('ypc-container');
  if (existingContainer) existingContainer.remove();
}

function performSmoothSeek(video, amount) {
  const now = Date.now();
  if (originalSpeed === null) originalSpeed = video.playbackRate;
  
  let tempSpeed;
  let timeNeededMs;
  
  if (amount > 0) {
    tempSpeed = Math.min(originalSpeed + 3.0, 16.0);
    const speedDiff = tempSpeed - originalSpeed;
    if (speedDiff <= 0) { video.currentTime += amount; return; }
    timeNeededMs = (amount / speedDiff) * 1000;
  } else {
    tempSpeed = 0.1;
    const speedDiff = tempSpeed - originalSpeed;
    if (speedDiff >= 0) { video.currentTime += amount; return; }
    timeNeededMs = (amount / speedDiff) * 1000;
  }
  
  video.playbackRate = tempSpeed;
  
  if (now < smoothSeekEndTime) {
    smoothSeekEndTime += timeNeededMs;
  } else {
    smoothSeekEndTime = now + timeNeededMs;
    const checkEnd = () => {
      if (Date.now() >= smoothSeekEndTime || document.hidden) {
        if (originalSpeed !== null) {
          video.playbackRate = originalSpeed; 
          originalSpeed = null;
        }
      } else {
        requestAnimationFrame(checkEnd);
      }
    };
    requestAnimationFrame(checkEnd);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && originalSpeed !== null) {
    const video = document.querySelector('video');
    if (video) {
      video.playbackRate = originalSpeed;
      originalSpeed = null;
      smoothSeekEndTime = 0;
    }
  }
});

function injectPlayerUI() {
  if (!settingsLoaded || !userSettings.masterEnable) return; 

  const video = document.querySelector('video');
  if (!video) return;

  const isYouTube = window.location.hostname.includes('youtube.com');
  const isNiconico = window.location.hostname.includes('nicovideo.jp');

  if (isNiconico && !userSettings.enableNico) {
    removePlayerUI();
    return;
  }

  let playerContainer;
  if (isYouTube) {
    playerContainer = document.querySelector('.html5-video-player');
  } else if (isNiconico) {
    playerContainer = video.parentElement; 
  }

  if (!playerContainer) return;
  if (document.getElementById('ypc-container')) return;

  if (!video.dataset.ypcEventsBound) {
    video.dataset.ypcEventsBound = 'true';
    video.addEventListener('loadedmetadata', () => {
      if (localStorage.getItem('ypc-auto-loop') === 'true') video.loop = true;
    });
    if (localStorage.getItem('ypc-auto-loop') === 'true') video.loop = true;

    if (isYouTube) {
      video.addEventListener('ratechange', () => {
        const speedSlider = document.getElementById('ypc-speed-slider');
        const speedDisplay = document.getElementById('ypc-speed-display');
        if (speedSlider && speedDisplay && originalSpeed === null) {
          speedDisplay.innerText = video.playbackRate.toFixed(2) + 'x';
          speedSlider.value = video.playbackRate;
        }
      });
    }
    video.addEventListener('play', () => {
      const btn = document.getElementById('ypc-play-pause');
      if (btn) btn.innerText = '⏸';
    });
    video.addEventListener('pause', () => {
      const btn = document.getElementById('ypc-play-pause');
      if (btn) btn.innerText = '▶';
    });
  }

  if (!document.getElementById('ypc-styles')) {
    const style = document.createElement('style');
    style.id = 'ypc-styles';
    style.textContent = `
      #ypc-container {
        position: absolute;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        transform-origin: bottom center; 
        z-index: 9999;
        background: rgba(28, 28, 28, 0.85);
        backdrop-filter: blur(4px);
        color: #eee;
        padding: 12px 20px;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: center;
        font-family: "YouTube Noto", Roboto, sans-serif;
        font-size: 15px;
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.1);
        width: max-content; 
      }
      .html5-video-player:hover #ypc-container { opacity: var(--ypc-hover-opacity, 1.0); }
      #ypc-container:hover { opacity: var(--ypc-hover-opacity, 1.0); }
      
      .ypc-row {
        display: flex;
        align-items: center;
        justify-content: flex-start; 
        gap: 20px;
        width: 100%;
      }
      .ypc-group {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ypc-label {
        font-weight: 500;
        margin-right: 4px;
        color: #aaa;
      }
      
      .ypc-btn {
        background: rgba(255, 255, 255, 0.15);
        border: none;
        color: white;
        padding: 8px 12px;
        font-size: 15px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        transition: background 0.1s;
      }
      .ypc-btn:hover { background: rgba(255, 255, 255, 0.25); }
      .ypc-btn:active { background: rgba(255, 255, 255, 0.4); }
      
      .ypc-btn.active-loop { background: rgba(204, 0, 0, 0.8); }
      .ypc-btn.active-loop:hover { background: rgba(255, 50, 50, 0.9); }

      #ypc-speed-slider {
        cursor: pointer;
        width: 100px;
        accent-color: #f00;
      }

      .ypc-loop-group-yt {
        margin-left: auto;
        border-left: 1px solid #555;
        padding-left: 20px;
      }

      #ypc-container.ypc-compact {
        width: 90%; 
        padding: 10px 15px;
        gap: 10px;
      }
      #ypc-container.ypc-compact .ypc-row {
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
      }
      #ypc-container.ypc-compact .ypc-group {
        flex-wrap: wrap;
        justify-content: center;
        width: 100%;
      }
      #ypc-container.ypc-compact .ypc-btn {
        flex: 1 1 auto;
        padding: 12px 5px;
        text-align: center;
      }
      #ypc-container.ypc-compact .ypc-loop-group-yt {
        margin-left: 0;
        border-left: none;
        padding-left: 0;
      }
    `;
    document.head.appendChild(style);
  }

  const container = document.createElement('div');
  container.id = 'ypc-container';
  
  ['click', 'mousedown', 'dblclick', 'touchstart'].forEach(eventType => {
    container.addEventListener(eventType, (e) => e.stopPropagation());
  });

  const speedUI = isYouTube ? `
    <div class="ypc-group">
      <span class="ypc-label">Speed:</span>
      <button class="ypc-btn" id="ypc-speed-down">-0.01</button>
      <span id="ypc-speed-display" style="width: 48px; text-align: center; font-variant-numeric: tabular-nums; font-size: 15px; font-weight: bold;">1.00x</span>
      <button class="ypc-btn" id="ypc-speed-up">+0.01</button>
      <input type="range" id="ypc-speed-slider" min="0.1" max="4.0" step="0.01" value="1.0" style="margin-left: 8px; flex: 1;">
      <button class="ypc-btn" id="ypc-speed-reset">Reset</button>
    </div>
  ` : '';

  const loopGroupClass = isYouTube ? "ypc-group ypc-loop-group-yt" : "ypc-group";

  container.innerHTML = `
    <div class="ypc-row">
      <button class="ypc-btn" id="ypc-play-pause" style="min-width: 40px; flex: 0 0 auto;">▶</button>
      <div class="ypc-group" style="flex: 1;">
        <span class="ypc-label">Adjust:</span>
        <button class="ypc-btn ypc-seek" data-val="-5">-5s</button>
        <button class="ypc-btn ypc-seek" data-val="5">+5s</button>
        <button class="ypc-btn ypc-seek" data-val="-1">-1s</button>
        <button class="ypc-btn ypc-seek" data-val="1">+1s</button>
        <button class="ypc-btn ypc-seek" data-val="-0.1">-0.1s</button>
        <button class="ypc-btn ypc-seek" data-val="0.1">+0.1s</button>
      </div>
    </div>
    <div class="ypc-row">
      ${speedUI}
      <div class="${loopGroupClass}">
        <button class="ypc-btn" id="ypc-loop-toggle" style="min-width: 90px;">Loop: OFF</button>
      </div>
    </div>
  `;

  playerContainer.appendChild(container);

  setTimeout(updateUIPosition, 50);

  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      const width = entry.contentRect.width;
      
      if (width < 650) {
        container.classList.add('ypc-compact');
        container.style.transform = `translateX(-50%) scale(1.0)`;
      } else {
        container.classList.remove('ypc-compact');
        let scale = width / 800;
        if (scale > 1.0) scale = 1.0;
        if (scale < 0.6) scale = 0.6;
        container.style.transform = `translateX(-50%) scale(${scale})`;
      }
      updateUIPosition();
    }
  });
  resizeObserver.observe(playerContainer);

  const playPauseBtn = container.querySelector('#ypc-play-pause');
  playPauseBtn.innerText = video.paused ? '▶' : '⏸'; 
  playPauseBtn.addEventListener('click', () => {
    if (video.paused) video.play();
    else video.pause();
  });

  container.querySelectorAll('.ypc-seek').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseFloat(btn.getAttribute('data-val'));
      if (Math.abs(val) <= 0.2 && !document.hidden) {
        performSmoothSeek(video, val);
      } else {
        video.currentTime += val;
      }
    });
  });

  if (isYouTube) {
    const speedSlider = container.querySelector('#ypc-speed-slider');
    const speedDisplay = container.querySelector('#ypc-speed-display');

    const updateSpeed = (newSpeed) => {
      newSpeed = Math.round(newSpeed * 100) / 100;
      if (newSpeed < 0.1) newSpeed = 0.1;
      if (newSpeed > 16.0) newSpeed = 16.0;

      if (originalSpeed !== null) originalSpeed = newSpeed;
      else video.playbackRate = newSpeed;
      
      speedDisplay.innerText = newSpeed.toFixed(2) + 'x';
      speedSlider.value = newSpeed;
    };

    speedSlider.addEventListener('input', (e) => updateSpeed(parseFloat(e.target.value)));
    container.querySelector('#ypc-speed-reset').addEventListener('click', () => updateSpeed(1.0));
    container.querySelector('#ypc-speed-down').addEventListener('click', () => {
      const currentSpeed = originalSpeed !== null ? originalSpeed : video.playbackRate;
      updateSpeed(currentSpeed - 0.01);
    });
    container.querySelector('#ypc-speed-up').addEventListener('click', () => {
      const currentSpeed = originalSpeed !== null ? originalSpeed : video.playbackRate;
      updateSpeed(currentSpeed + 0.01);
    });
    speedSlider.addEventListener('wheel', (e) => {
      e.preventDefault(); 
      const currentSpeed = originalSpeed !== null ? originalSpeed : video.playbackRate;
      if (e.deltaY < 0) updateSpeed(currentSpeed + 0.01); 
      else updateSpeed(currentSpeed - 0.01); 
    });
  }

  const loopBtn = container.querySelector('#ypc-loop-toggle');
  let isAutoLoop = localStorage.getItem('ypc-auto-loop') === 'true';

  if (isAutoLoop) {
    loopBtn.innerText = 'Loop: ON';
    loopBtn.classList.add('active-loop');
  }

  loopBtn.addEventListener('click', () => {
    isAutoLoop = !isAutoLoop;
    localStorage.setItem('ypc-auto-loop', isAutoLoop); 
    video.loop = isAutoLoop; 

    if (isAutoLoop) {
      loopBtn.innerText = 'Loop: ON';
      loopBtn.classList.add('active-loop');
    } else {
      loopBtn.innerText = 'Loop: OFF';
      loopBtn.classList.remove('active-loop');
    }
  });
}

setInterval(injectPlayerUI, 1000);