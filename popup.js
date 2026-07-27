document.addEventListener('DOMContentLoaded', () => {
  // ★重要：ここをご自身のGitHubに合わせて書き換えてください！
  // 例: "ユーザー名/リポジトリ名"
  const GITHUB_REPO = "kuroten-kgw/YouTube-In-Player-Controller"; 

  const masterEnableCb = document.getElementById('master-enable');
  const opacitySlider = document.getElementById('opacity-slider');
  const opacityVal = document.getElementById('opacity-val');
  const nicoEnableCb = document.getElementById('nico-enable');
  const saveBtn = document.getElementById('save-btn');
  
  const updateBtn = document.getElementById('update-btn');
  const updateStatus = document.getElementById('update-status');

  opacitySlider.addEventListener('input', () => {
    opacityVal.textContent = opacitySlider.value;
  });

  // 保存されている設定を読み込む
  chrome.storage.sync.get({
    masterEnable: true, // 初期値はON
    uiOpacity: 1.0,
    enableNico: false
  }, (items) => {
    masterEnableCb.checked = items.masterEnable;
    opacitySlider.value = items.uiOpacity;
    opacityVal.textContent = items.uiOpacity.toFixed(1);
    nicoEnableCb.checked = items.enableNico;
  });

  // 保存ボタン
  saveBtn.addEventListener('click', () => {
    chrome.storage.sync.set({
      masterEnable: masterEnableCb.checked,
      uiOpacity: parseFloat(opacitySlider.value),
      enableNico: nicoEnableCb.checked
    }, () => {
      window.close();
    });
  });

  // アップデート確認ボタン
  updateBtn.addEventListener('click', async () => {
    if (GITHUB_REPO === "YOUR_GITHUB_NAME/YOUR_REPO_NAME") {
      updateStatus.innerHTML = "<span style='color:red;'>※コード内のGitHubリポジトリ名(YOUR_...)が書き換えられていません。</span>";
      return;
    }

    updateBtn.disabled = true;
    updateStatus.textContent = "確認中...";
    updateStatus.style.color = "#333";

    try {
      // GitHubのRelease情報を取得
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
      if (!res.ok) throw new Error('取得失敗');
      
      const data = await res.json();
      
      // "v1.2" のようなタグ名から "v" を取り除く
      const latestVersion = data.tag_name.replace(/^v/, ''); 
      const currentVersion = chrome.runtime.getManifest().version;

      // バージョンの比較（1.1 と 1.2 などを比較）
      if (latestVersion.localeCompare(currentVersion, undefined, { numeric: true, sensitivity: 'base' }) > 0) {
        updateStatus.innerHTML = `🎉 新バージョン (v${latestVersion}) があります！<br><a href="${data.html_url}" target="_blank" style="color: #1976d2; font-weight: bold; text-decoration: underline;">ダウンロードページを開く</a>`;
      } else {
        updateStatus.textContent = "最新バージョンをご利用中です。";
      }
    } catch (err) {
      updateStatus.innerHTML = "<span style='color:red;'>確認に失敗しました。リポジトリが公開(Public)になっているか確認してください。</span>";
    } finally {
      updateBtn.disabled = false;
    }
  });
});