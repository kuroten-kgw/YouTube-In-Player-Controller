let originalSpeed = null;
let smoothSeekEndTime = 0;

let userSettings = { masterEnable: true, uiPosition: 15, uiOpacity: 1.0, enableThirdRow: true, quickLoopTime: 10, enableNico: false };
let settingsLoaded = false;

let loopA = null;
let loopB = null;
let hotCues = { 1: null, 2: null, 3: null };

function updateLoopUI() {
  const btnA = document.getElementById('ypc-loop-a');
  const btnB = document.getElementById('ypc-loop-b');
  if (btnA) btnA.classList.toggle('active-loop-ab', loopA !== null);
  if (btnB) btnB.classList.toggle('active-loop-ab', loopB !== null);
}

function updateCueButtonUI(num) {
  const btn = document.querySelector(`.ypc-cue[data-cue="${num}"]`);
  if (btn) btn.classList.toggle('active-cue', hotCues[num] !== null);
}

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
    const actualUiHeight = container.getBoundingClientRect().height || (userSettings.enableThirdRow ? 140 : 90); 
    
    const minBottom = 60; 
    const maxBottom = Math.max(minBottom, playerHeight - actualUiHeight - 10);
    const posVal = Math.max(0, Math.min(100, userSettings.uiPosition));
    const targetPx = minBottom + (maxBottom - minBottom) * (posVal / 100);

    container.style.bottom = `${targetPx}px`;
  }
}

chrome.storage.local.get({ masterEnable: true, uiPosition: 15, uiOpacity: 1.0, enableThirdRow: true, quickLoopTime: 10, enableNico: false }, (items) => {
  userSettings = items;
  settingsLoaded = true;
  document.documentElement.style.setProperty('--ypc-hover-opacity', userSettings.uiOpacity);
  if (!userSettings.masterEnable) removePlayerUI();
  else updateUIPosition();
});

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
    if (changes.enableThirdRow || changes.quickLoopTime) {
      if (changes.enableThirdRow) userSettings.enableThirdRow = changes.enableThirdRow.newValue;
      if (changes.quickLoopTime) userSettings.quickLoopTime = changes.quickLoopTime.newValue;
      
      const row3 = document.querySelector('.ypc-row-3');
      if (row3) row3.style.display = userSettings.enableThirdRow ? 'flex' : 'none';
      
      const quickBtn = document.getElementById('ypc-loop-quick');
      if (quickBtn) quickBtn.innerText = `+${userSettings.quickLoopTime}s`;
      
      window.dispatchEvent(new Event('resize')); 
    }
    if (changes.enableNico) {
      userSettings.enableNico = changes.enableNico.newValue;
      if (!userSettings.enableNico && window.location.hostname.includes('nicovideo.jp')) removePlayerUI();
      else if (userSettings.enableNico) injectPlayerUI();
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

if (!window.ypcKeyEventsBound) {
  window.ypcKeyEventsBound = true;
  document.addEventListener('keydown', (e) => {
    if (!settingsLoaded || !userSettings.masterEnable || !userSettings.enableThirdRow) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;

    let cueNum = null;
    if (e.code === 'KeyQ') cueNum = 1;
    if (e.code === 'KeyW') cueNum = 2;
    if (e.code === 'KeyE') cueNum = 3;

    if (cueNum) {
      e.stopPropagation();
      e.preventDefault(); 
      const video = document.querySelector('video');
      if (!video) return;

      if (e.shiftKey) {
        hotCues[cueNum] = null;
        updateCueButtonUI(cueNum);
      } else {
        if (hotCues[cueNum] !== null) video.currentTime = hotCues[cueNum];
        else { hotCues[cueNum] = video.currentTime; updateCueButtonUI(cueNum); }
      }
    }
  }, { capture: true });
}

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

  let playerContainer = isYouTube ? document.querySelector('.html5-video-player') : video.parentElement;
  if (!playerContainer) return;
  
  if (document.getElementById('ypc-container')) {
    if (isYouTube) {
      const speedSlider = document.getElementById('ypc-speed-slider');
      const speedDisplay = document.getElementById('ypc-speed-display');
      if (speedSlider && speedDisplay && originalSpeed === null) {
        if (parseFloat(speedSlider.value) !== video.playbackRate) {
          speedSlider.value = video.playbackRate;
          speedDisplay.innerText = video.playbackRate.toFixed(2) + 'x';
        }
      }
    }
    return;
  }

  if (!video.dataset.ypcEventsBound) {
    video.dataset.ypcEventsBound = 'true';
    
    video.addEventListener('loadedmetadata', () => {
      if (localStorage.getItem('ypc-auto-loop') === 'true') video.loop = true;
      loopA = null; loopB = null; hotCues = { 1: null, 2: null, 3: null };
      updateLoopUI();
      updateCueButtonUI(1); updateCueButtonUI(2); updateCueButtonUI(3);
    });
    
    if (localStorage.getItem('ypc-auto-loop') === 'true') video.loop = true;

    // ★ 動画再生時間の監視（A-Bループと、再生リストの強制ループ処理）
    video.addEventListener('timeupdate', () => {
      // 1. A-B Loop の処理
      if (loopA !== null && loopB !== null && video.currentTime >= loopB) {
        video.currentTime = loopA;
      } 
      // 2. 全体ループの処理（再生リストで次の動画に飛ばされるのを防ぐため）
    else if (video.loop && video.duration > 0 && video.currentTime >= video.duration - 0.2) {
      video.currentTime = 0;
      }
    });

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
      .ypc-btn.active-loop-ab { background: rgba(0, 150, 136, 0.9); }
      .ypc-btn.active-cue { background: rgba(255, 160, 0, 0.9); color: #fff; }

      #ypc-speed-slider { cursor: pointer; width: 100px; accent-color: #f00; }

      .ypc-loop-group-yt { margin-left: auto; border-left: 1px solid #555; padding-left: 20px; }

      #ypc-container.ypc-compact { width: 90%; padding: 10px 15px; gap: 10px; }
      #ypc-container.ypc-compact .ypc-row { flex-wrap: wrap; justify-content: center; gap: 8px; }
      #ypc-container.ypc-compact .ypc-group { flex-wrap: wrap; justify-content: center; width: 100%; }
      #ypc-container.ypc-compact .ypc-btn { flex: 1 1 auto; padding: 12px 5px; text-align: center; }
      #ypc-container.ypc-compact .ypc-loop-group-yt { margin-left: 0; border-left: none; padding-left: 0; }
    `;
    document.head.appendChild(style);
  }

  const container = document.createElement('div');
  container.id = 'ypc-container';
  
  ['click', 'mousedown', 'dblclick', 'touchstart', 'contextmenu'].forEach(eType => {
    container.addEventListener(eType, (e) => e.stopPropagation());
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
  const row3Display = userSettings.enableThirdRow ? "flex" : "none";

  container.innerHTML = `
    <div class="ypc-row">
      <button class="ypc-btn" id="ypc-play-pause" style="min-width: 40px; flex: 0 0 auto;">▶</button>
      <div class="ypc-group" style="flex: 1;">
        <span class="ypc-label">Adjust:</span>
        <button class="ypc-btn" id="ypc-seek-start" title="最初に戻る">|◀</button>
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
        <span class="ypc-label" style="display:none;"></span>
        <button class="ypc-btn" id="ypc-loop-toggle" style="min-width: 90px;">Loop: OFF</button>
      </div>
    </div>

    <div class="ypc-row ypc-row-3" style="display: ${row3Display}; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-top: -5px;">
      <div class="ypc-group">
        <span class="ypc-label">A-B Loop:</span>
        <button class="ypc-btn" id="ypc-loop-a">In</button>
        <button class="ypc-btn" id="ypc-loop-b">Out</button>
        <button class="ypc-btn" id="ypc-loop-quick">+${userSettings.quickLoopTime}s</button>
        <button class="ypc-btn" id="ypc-loop-clear">Clear</button>
      </div>
      <div class="ypc-group" style="margin-left: auto; border-left: 1px solid #555; padding-left: 15px;">
        <span class="ypc-label" title="未登録時に押すと現在地を記憶&#10;右クリック / Shift+キー で削除">HOT CUE (Q/W/E):</span>
        <button class="ypc-btn ypc-cue" data-cue="1">1</button>
        <button class="ypc-btn ypc-cue" data-cue="2">2</button>
        <button class="ypc-btn ypc-cue" data-cue="3">3</button>
      </div>
    </div>
  `;

  playerContainer.appendChild(container);
  setTimeout(updateUIPosition, 50);

  updateLoopUI();
  updateCueButtonUI(1); updateCueButtonUI(2); updateCueButtonUI(3);

  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      const width = entry.contentRect.width;
      const pHeight = entry.contentRect.height;
      
      if (width < 650) {
        container.classList.add('ypc-compact');
        let scale = 1.0;
        
        if (userSettings.enableThirdRow) {
          if (pHeight < 250) scale = 0.6;
          else if (pHeight < 350) scale = 0.75;
          else scale = 0.9;
        }
        
        container.style.transform = `translateX(-50%) scale(${scale})`;
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
  window.addEventListener('resize', updateUIPosition);

  const playPauseBtn = container.querySelector('#ypc-play-pause');
  playPauseBtn.innerText = video.paused ? '▶' : '⏸'; 
  playPauseBtn.addEventListener('click', () => { video.paused ? video.play() : video.pause(); });

  container.querySelector('#ypc-seek-start').addEventListener('click', () => { video.currentTime = 0; });

  container.querySelectorAll('.ypc-seek').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseFloat(btn.getAttribute('data-val'));
      if (Math.abs(val) <= 0.2 && !document.hidden) performSmoothSeek(video, val);
      else video.currentTime += val;
    });
  });

  container.querySelector('#ypc-loop-a').addEventListener('click', () => { loopA = video.currentTime; updateLoopUI(); });
  container.querySelector('#ypc-loop-b').addEventListener('click', () => { loopB = video.currentTime; updateLoopUI(); });
  container.querySelector('#ypc-loop-quick').addEventListener('click', () => {
    loopA = video.currentTime;
    loopB = video.currentTime + userSettings.quickLoopTime;
    updateLoopUI();
  });
  container.querySelector('#ypc-loop-clear').addEventListener('click', () => { loopA = null; loopB = null; updateLoopUI(); });

  container.querySelectorAll('.ypc-cue').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const num = parseInt(btn.getAttribute('data-cue'), 10);
      if (hotCues[num] !== null) {
        video.currentTime = hotCues[num];
      } else {
        hotCues[num] = video.currentTime;
        updateCueButtonUI(num);
      }
    });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault(); 
      const num = parseInt(btn.getAttribute('data-cue'), 10);
      hotCues[num] = null;
      updateCueButtonUI(num);
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
  if (isAutoLoop) { loopBtn.innerText = 'Loop: ON'; loopBtn.classList.add('active-loop'); }

  loopBtn.addEventListener('click', () => {
    isAutoLoop = !isAutoLoop;
    localStorage.setItem('ypc-auto-loop', isAutoLoop); 
    video.loop = isAutoLoop; 
    if (isAutoLoop) { loopBtn.innerText = 'Loop: ON'; loopBtn.classList.add('active-loop'); } 
    else { loopBtn.innerText = 'Loop: OFF'; loopBtn.classList.remove('active-loop'); }
  });
}

setInterval(injectPlayerUI, 1000);