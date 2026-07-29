document.addEventListener('DOMContentLoaded', () => {
  // リポジトリ名を設定済み
  const GITHUB_REPO = "kuroten-kgw/YouTube-In-Player-Controller"; 

  const masterEnableCb = document.getElementById('master-enable');
  const posSlider = document.getElementById('pos-slider');
  const posVal = document.getElementById('pos-val');
  const opacitySlider = document.getElementById('opacity-slider');
  const opacityVal = document.getElementById('opacity-val');
  const nicoEnableCb = document.getElementById('nico-enable');
  const closeBtn = document.getElementById('close-btn');
  
  const updateBtn = document.getElementById('update-btn');
  const updateStatus = document.getElementById('update-status');

  // ★ sync.set から local.set に変更（回数制限を回避）
  const saveSettingsInstantly = () => {
    chrome.storage.local.set({
      masterEnable: masterEnableCb.checked,
      uiPosition: parseInt(posSlider.value, 10), 
      uiOpacity: parseFloat(opacitySlider.value),
      enableNico: nicoEnableCb.checked
    });
  };

  // ★ sync.get から local.get に変更
  chrome.storage.local.get({
    masterEnable: true,
    uiPosition: 15, 
    uiOpacity: 1.0,
    enableNico: false
  }, (items) => {
    masterEnableCb.checked = items.masterEnable;
    posSlider.value = items.uiPosition;
    posVal.textContent = items.uiPosition;
    opacitySlider.value = items.uiOpacity;
    opacityVal.textContent = items.uiOpacity.toFixed(1);
    nicoEnableCb.checked = items.enableNico;
  });

  masterEnableCb.addEventListener('change', saveSettingsInstantly);
  nicoEnableCb.addEventListener('change', saveSettingsInstantly);
  
  posSlider.addEventListener('input', () => { 
    posVal.textContent = posSlider.value; 
    saveSettingsInstantly();
  });
  
  opacitySlider.addEventListener('input', () => { 
    opacityVal.textContent = opacitySlider.value; 
    saveSettingsInstantly();
  });

  const enableWheelOnSlider = (slider, step) => {
    slider.addEventListener('wheel', (e) => {
      e.preventDefault(); 
      const currentVal = parseFloat(slider.value);
      if (e.deltaY < 0) { 
        slider.value = Math.min(parseFloat(slider.max), currentVal + step);
      } else { 
        slider.value = Math.max(parseFloat(slider.min), currentVal - step);
      }
      slider.dispatchEvent(new Event('input')); 
    });
  };

  enableWheelOnSlider(posSlider, 1);
  enableWheelOnSlider(opacitySlider, 0.1);

  closeBtn.addEventListener('click', () => {
    window.close();
  });

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
        updateStatus.innerHTML = `🎉 新バージョン (v${latestVersion}) があります！<br><a href="${data.html_url}" target="_blank" style="color: #1976d2; font-weight: bold; text-decoration: underline;">ダウンロードページを開く</a>`;
      } else {
        updateStatus.textContent = "最新バージョンをご利用中です。";
      }
    } catch (err) {
      updateStatus.innerHTML = "<span style='color:red;'>確認に失敗しました。リポジトリが公開になっているか確認してください。</span>";
    } finally {
      updateBtn.disabled = false;
    }
  });
});