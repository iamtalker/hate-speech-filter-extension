// 파이어폭스는 매니페스트의 background.scripts로 wordlists.js, settings-utils.js를 먼저 불러온다.
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get("hsfSettings");
  if (!data.hsfSettings) {
    await chrome.storage.sync.set({ hsfSettings: HSF_normalizeSettings({}) });
  }
});
