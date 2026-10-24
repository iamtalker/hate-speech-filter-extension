importScripts("wordlists.js", "settings-utils.js");

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get("hsfSettings");
  if (!data.hsfSettings) {
    await chrome.storage.sync.set({ hsfSettings: HSF_normalizeSettings({}) });
  }
});
