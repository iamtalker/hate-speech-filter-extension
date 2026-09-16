const HSF_DEFAULT_SETTINGS = {
  enabled: true,
  categories: { region: true, gender: true, nationality: true, disability: false },
  customWords: []
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get("hsfSettings");
  if (!data.hsfSettings) {
    await chrome.storage.sync.set({ hsfSettings: HSF_DEFAULT_SETTINGS });
  }
});
