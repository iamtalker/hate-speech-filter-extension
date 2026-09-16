const STORAGE_KEY = "hsfSettings";

const WORD_TYPES = [
  { key: "groupTerms", title: "집단 식별어 (단독으로는 차단 안 함)", cls: "wg-group" },
  { key: "explicitSlurs", title: "명백한 멸칭 (즉시 차단)", cls: "wg-explicit" },
  { key: "ambiguousSlurs", title: "모호한 표현 (집단어와 같이 나올 때만 차단)", cls: "wg-ambiguous" }
];

let settings = HSF_normalizeSettings({});

const masterToggle = document.getElementById("masterToggle");
const categoryList = document.getElementById("categoryList");
const customWordInput = document.getElementById("customWordInput");
const addWordBtn = document.getElementById("addWordBtn");
const customWordList = document.getElementById("customWordList");

function save() {
  chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

function isDefaultWord(cat, type, word) {
  return HSF_DEFAULT_WORDLISTS[cat][type].includes(word);
}

function removeWord(cat, type, word) {
  const ov = settings.overrides[cat];
  const addedIdx = ov.added[type].indexOf(word);
  if (addedIdx !== -1) {
    ov.added[type].splice(addedIdx, 1);
  } else if (!ov.removed.includes(word)) {
    ov.removed.push(word);
  }
  save();
  renderCategories();
}

function addWord(cat, type, rawWord) {
  const word = rawWord.trim();
  if (!word) return;
  const ov = settings.overrides[cat];
  const removedIdx = ov.removed.indexOf(word);
  if (removedIdx !== -1) {
    ov.removed.splice(removedIdx, 1);
  } else if (!isDefaultWord(cat, type, word) && !ov.added[type].includes(word)) {
    ov.added[type].push(word);
  }
  save();
  renderCategories();
}

function resetCategory(cat) {
  settings.overrides[cat] = HSF_emptyOverride();
  save();
  renderCategories();
}

function renderWordType(cat, type, title, cls, words) {
  const wrap = document.createElement("div");
  wrap.className = "word-group " + cls;

  const b = document.createElement("b");
  b.textContent = title;
  wrap.appendChild(b);

  const tagList = document.createElement("div");
  tagList.className = "tag-list";
  words.forEach((word) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = word;

    const x = document.createElement("button");
    x.type = "button";
    x.className = "tag-remove";
    x.textContent = "×";
    x.title = "삭제";
    x.addEventListener("click", () => removeWord(cat, type, word));

    tag.appendChild(x);
    tagList.appendChild(tag);
  });
  if (!words.length) {
    const empty = document.createElement("span");
    empty.className = "tag-empty";
    empty.textContent = "(없음)";
    tagList.appendChild(empty);
  }
  wrap.appendChild(tagList);

  const addRow = document.createElement("div");
  addRow.className = "add-row add-row-small";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "단어 추가";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "+";
  const submit = () => {
    addWord(cat, type, input.value);
    input.value = "";
  };
  addBtn.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
  addRow.appendChild(input);
  addRow.appendChild(addBtn);
  wrap.appendChild(addRow);

  return wrap;
}

function renderCategories() {
  categoryList.innerHTML = "";
  for (const [cat, data] of Object.entries(HSF_DEFAULT_WORDLISTS)) {
    const merged = HSF_getMergedLists(cat, settings.overrides);

    const li = document.createElement("li");

    const header = document.createElement("div");
    header.className = "cat-header";

    const label = document.createElement("span");
    label.textContent = data.label;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!settings.categories[cat];
    input.addEventListener("change", () => {
      settings.categories[cat] = input.checked;
      save();
    });

    header.appendChild(label);
    header.appendChild(input);

    const details = document.createElement("details");
    details.className = "cat-words";

    const summary = document.createElement("summary");
    summary.textContent = "단어 보기 / 추가·삭제";
    details.appendChild(summary);

    WORD_TYPES.forEach((t) => {
      details.appendChild(renderWordType(cat, t.key, t.title, t.cls, merged[t.key]));
    });

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "reset-btn";
    resetBtn.textContent = "이 카테고리 기본값으로 초기화";
    resetBtn.addEventListener("click", () => resetCategory(cat));
    details.appendChild(resetBtn);

    li.appendChild(header);
    li.appendChild(details);
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
  settings = HSF_normalizeSettings(data[STORAGE_KEY]);
  masterToggle.checked = settings.enabled;
  renderCategories();
  renderCustomWords();
});
