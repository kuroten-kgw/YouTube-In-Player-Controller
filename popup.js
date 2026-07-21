document.addEventListener('DOMContentLoaded', () => {
  const opacitySlider = document.getElementById('opacity-slider');
  const opacityVal = document.getElementById('opacity-val');
  const nicoEnableCb = document.getElementById('nico-enable');
  const saveBtn = document.getElementById('save-btn');

  // スライダーを動かしたときに数値をリアルタイム更新
  opacitySlider.addEventListener('input', () => {
    opacityVal.textContent = opacitySlider.value;
  });

  // 保存されている設定を読み込む
  chrome.storage.sync.get({
    uiOpacity: 1.0,
    enableNico: false
  }, (items) => {
    opacitySlider.value = items.uiOpacity;
    opacityVal.textContent = items.uiOpacity.toFixed(1);
    nicoEnableCb.checked = items.enableNico;
  });

  // 保存ボタンが押された時の処理
  saveBtn.addEventListener('click', () => {
    chrome.storage.sync.set({
      uiOpacity: parseFloat(opacitySlider.value),
      enableNico: nicoEnableCb.checked
    }, () => {
      // データの保存が完了したらポップアップを自動で閉じる
      window.close();
    });
  });
});