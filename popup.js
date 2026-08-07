document.addEventListener('DOMContentLoaded', () => {
  const GITHUB_REPO = "kuroten-kgw/YouTube-In-Player-Controller"; 

  const masterEnableCb = document.getElementById('master-enable');
  const posSlider = document.getElementById('pos-slider');
  const posVal = document.getElementById('pos-val');
  const opacitySlider = document.getElementById('opacity-slider');
  const opacityVal = document.getElementById('opacity-val');
  
  const thirdRowEnableCb = document.getElementById('third-row-enable');
  const quickLoopSlider = document.getElementById('quick-loop-slider');
  const quickLoopVal = document.getElementById('quick-loop-val');
  
  const nicoEnableCb = document.getElementById('nico-enable');
  const closeBtn = document.getElementById('close-btn');
  const updateBtn = document.getElementById('update-btn');
  const updateStatus = document.getElementById('update-status');

  const saveSettingsInstantly = () => {
    chrome.storage.local.set({
      masterEnable: masterEnableCb.checked,
      uiPosition: parseInt(posSlider.value, 10), 
      uiOpacity: parseFloat(opacitySlider.value),
      enableThirdRow: thirdRowEnableCb.checked,
      quickLoopTime: parseInt(quickLoopSlider.value, 10),
      enableNico: nicoEnableCb.checked
    });
  };

  chrome.storage.local.get({ 
    masterEnable: true, 
    uiPosition: 15, 
    uiOpacity: 1.0, 
    enableThirdRow: true,
    quickLoopTime: 10,
    enableNico: false 
  }, (items) => {
    masterEnableCb.checked = items.masterEnable;
    posSlider.value = items.uiPosition;
    posVal.textContent = items.uiPosition;
    opacitySlider.value = items.uiOpacity;
    opacityVal.textContent = items.uiOpacity.toFixed(1);
    
    thirdRowEnableCb.checked = items.enableThirdRow;
    quickLoopSlider.value = items.quickLoopTime;
    quickLoopVal.textContent = items.quickLoopTime;
    
    nicoEnableCb.checked = items.enableNico;
  });

  masterEnableCb.addEventListener('change', saveSettingsInstantly);
  nicoEnableCb.addEventListener('change', saveSettingsInstantly);
  thirdRowEnableCb.addEventListener('change', saveSettingsInstantly);
  
  posSlider.addEventListener('input', () => { posVal.textContent = posSlider.value; saveSettingsInstantly(); });
  opacitySlider.addEventListener('input', () => { opacityVal.textContent = opacitySlider.value; saveSettingsInstantly(); });
  quickLoopSlider.addEventListener('input', () => { quickLoopVal.textContent = quickLoopSlider.value; saveSettingsInstantly(); });

  const enableWheelOnSlider = (slider, step) => {
    slider.addEventListener('wheel', (e) => {
      e.preventDefault(); 
      const currentVal = parseFloat(slider.value);
      if (e.deltaY < 0) slider.value = Math.min(parseFloat(slider.max), currentVal + step);
      else slider.value = Math.max(parseFloat(slider.min), currentVal - step);
      slider.dispatchEvent(new Event('input')); 
    });
  };
  enableWheelOnSlider(posSlider, 1);
  enableWheelOnSlider(opacitySlider, 0.1);
  enableWheelOnSlider(quickLoopSlider, 1);

  closeBtn.addEventListener('click', () => window.close());

  updateBtn.addEventListener('click', async () => {
    updateBtn.disabled = true;
    updateStatus.textContent = "確認中...";
    updateStatus.style.color = "#333";
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
      if (!res.ok) throw new Error('取得失敗');
      const data = await res.json();
      const latestVersion = data.tag_name.replace(/^v/, ''); 
      const currentVersion = chrome.runtime.getManifest().version;

      if (latestVersion.localeCompare(currentVersion, undefined, { numeric: true, sensitivity: 'base' }) > 0) {
        updateStatus.innerHTML = `🎉 新バージョン (v${latestVersion}) があります！<br><a href="${data.html_url}" target="_blank" style="color: #1976d2; font-weight: bold; text-decoration: underline;">ダウンロードを開く</a>`;
      } else {
        updateStatus.textContent = "最新バージョンをご利用中です。";
      }
    } catch (err) {
      updateStatus.innerHTML = "<span style='color:red;'>確認に失敗しました。</span>";
    } finally {
      updateBtn.disabled = false;
    }
  });
});