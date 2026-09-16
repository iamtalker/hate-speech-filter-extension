const STORAGE_KEY = "hsfSettings";
const DEFAULT_SETTINGS = {
  enabled: true,
  categories: { region: true, gender: true, nationality: true, disability: false },
  customWords: []
};

let settings = DEFAULT_SETTINGS;

const masterToggle = document.getElementById("masterToggle");
const categoryList = document.getElementById("categoryList");
const customWordInput = document.getElementById("customWordInput");
const addWordBtn = document.getElementById("addWordBtn");
const customWordList = document.getElementById("customWordList");

function save() {
  chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

function renderCategories() {
  categoryList.innerHTML = "";
  for (const [cat, data] of Object.entries(HSF_DEFAULT_WORDLISTS)) {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.textContent = data.label;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!settings.categories[cat];
    input.addEventListener("change", () => {
      settings.categories[cat] = input.checked;
      save();
    });

    li.appendChild(label);
    li.appendChild(input);
    categoryList.appendChild(li);
  }
}

function renderCustomWords() {
  customWordList.innerHTML = "";
  settings.customWords.forEach((word, idx) => {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.textContent = word;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "삭제";
    removeBtn.addEventListener("click", () => {
      settings.customWords.splice(idx, 1);
      save();
      renderCustomWords();
    });

    li.appendChild(label);
    li.appendChild(removeBtn);
    customWordList.appendChild(li);
  });
}

addWordBtn.addEventListener("click", () => {
  const word = customWordInput.value.trim();
  if (!word) return;
  if (!settings.customWords.includes(word)) {
    settings.customWords.push(word);
    save();
    renderCustomWords();
  }
  customWordInput.value = "";
});

customWordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addWordBtn.click();
});

masterToggle.addEventListener("change", () => {
  settings.enabled = masterToggle.checked;
  save();
});

chrome.storage.sync.get(STORAGE_KEY, (data) => {
  const stored = data[STORAGE_KEY] || {};
  settings = {
    enabled: stored.enabled !== undefined ? stored.enabled : DEFAULT_SETTINGS.enabled,
    categories: Object.assign({}, DEFAULT_SETTINGS.categories, stored.categories || {}),
    customWords: stored.customWords || []
  };
  masterToggle.checked = settings.enabled;
  renderCategories();
  renderCustomWords();
});
