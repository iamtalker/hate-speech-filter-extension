// 크롬은 서비스 워커라 importScripts로 불러오고, 파이어폭스는 매니페스트의
// background.scripts로 이미 불러와 있어서 importScripts가 없다.
if (typeof importScripts === "function") {
  importScripts("wordlists.js", "settings-utils.js");
}

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get("hsfSettings");
  if (!data.hsfSettings) {
    await chrome.storage.sync.set({ hsfSettings: HSF_normalizeSettings({}) });
  }
});
