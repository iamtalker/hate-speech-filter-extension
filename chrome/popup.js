const STORAGE_KEY = "hsfSettings";

const masterToggle = document.getElementById("masterToggle");
const displayModeInputs = {
  blur: document.getElementById("displayModeBlur"),
  hide: document.getElementById("displayModeHide"),
  remove: document.getElementById("displayModeRemove")
};

// 설정 페이지에서 바꾼 항목을 덮어쓰지 않도록, 저장된 설정을 읽어 이 팝업의 항목만 바꿔서 저장한다.
function update(changes) {
  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    const stored = HSF_normalizeSettings(data[STORAGE_KEY]);
    chrome.storage.sync.set({ [STORAGE_KEY]: { ...stored, ...changes } });
  });
}

masterToggle.addEventListener("change", () => update({ enabled: masterToggle.checked }));

for (const [mode, input] of Object.entries(displayModeInputs)) {
  input.addEventListener("change", () => {
    if (input.checked) update({ displayMode: mode });
  });
}

document.getElementById("openOptionsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

chrome.storage.sync.get(STORAGE_KEY, (data) => {
  const settings = HSF_normalizeSettings(data[STORAGE_KEY]);
  masterToggle.checked = settings.enabled;
  for (const [mode, input] of Object.entries(displayModeInputs)) {
    input.checked = settings.displayMode === mode;
  }
});
