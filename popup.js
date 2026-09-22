const STORAGE_KEY = "hsfSettings";

const WORD_TYPES = [
  { key: "explicitSlurs", title: "명백한 멸칭 (즉시 차단)", cls: "wg-explicit" },
  { key: "groupTerms", title: "집단 식별어 (단독으로는 차단 안 함)", cls: "wg-group" },
  { key: "ambiguousSlurs", title: "모호한 표현 (집단어와 같이 나올 때만 차단)", cls: "wg-ambiguous" }
];

let settings = { enabled: true, categories: [], excludedSites: [], displayMode: "blur" };

const masterToggle = document.getElementById("masterToggle");
const displayModeBlur = document.getElementById("displayModeBlur");
const displayModeHide = document.getElementById("displayModeHide");
const categoryList = document.getElementById("categoryList");
const resetAllBtn = document.getElementById("resetAllBtn");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const newCategoryInput = document.getElementById("newCategoryInput");
const addCategoryBtn = document.getElementById("addCategoryBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFileInput = document.getElementById("importFileInput");
const excludedSiteList = document.getElementById("excludedSiteList");
const newExcludedSiteInput = document.getElementById("newExcludedSiteInput");
const addExcludedSiteBtn = document.getElementById("addExcludedSiteBtn");
const addCurrentSiteBtn = document.getElementById("addCurrentSiteBtn");

function save() {
  chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

function removeCategory(cat) {
  if (!confirm(`"${cat.label}" 카테고리를 삭제할까요?`)) return;
  const idx = settings.categories.indexOf(cat);
  if (idx !== -1) settings.categories.splice(idx, 1);
  save();
  renderCategories();
}

function addCategory(rawLabel) {
  const label = rawLabel.trim();
  if (!label) return;
  settings.categories.push({
    id: HSF_genId(),
    label,
    enabled: true,
    groupTerms: [],
    explicitSlurs: [],
    ambiguousSlurs: []
  });
  save();
  renderCategories();
}

function resetAllCategories() {
  if (!confirm("모든 카테고리를 기본값(지역/성별/인종·국적/장애)으로 초기화할까요? 직접 추가·수정한 내용은 사라집니다.")) return;
  settings.categories = HSF_buildDefaultCategories();
  save();
  renderCategories();
}

function deleteAllCategories() {
  if (!confirm("카테고리를 전부 삭제할까요? 이 작업은 되돌릴 수 없습니다. (필요하면 나중에 '기본 카테고리로 초기화'로 다시 만들 수 있어요)")) return;
  settings.categories = [];
  save();
  renderCategories();
}

function exportCategories() {
  const payload = {
    hsfExportVersion: 1,
    exportedAt: new Date().toISOString(),
    categories: settings.categories
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hate-speech-filter-words-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

function importCategories(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (e) {
      alert("파일을 읽을 수 없습니다. 올바른 JSON 파일인지 확인해주세요.");
      return;
    }

    const rawCategories = Array.isArray(parsed) ? parsed : parsed.categories;
    if (!Array.isArray(rawCategories)) {
      alert("이 파일에는 카테고리 데이터가 없습니다.");
      return;
    }

    if (!confirm(`카테고리 ${rawCategories.length}개를 가져올까요? 현재 카테고리는 전부 대체됩니다.`)) return;

    settings.categories = rawCategories.map(HSF_sanitizeCategory);
    save();
    renderCategories();
  };
  reader.readAsText(file);
}

// 단어 하나 추가/삭제할 때 카테고리 목록 전체를 다시 그리면 열려있던 <details>가
// 전부 닫히고 팝업 레이아웃이 크게 흔들려 팝업이 닫혀버리는 문제가 있었다.
// 그래서 이 태그 목록만 직접 DOM을 조작해서 갱신한다 (전체 재렌더링 없음).
function renderWordType(cat, type, title, cls, words) {
  const wrap = document.createElement("div");
  wrap.className = "word-group " + cls;

  const b = document.createElement("b");
  b.textContent = title;
  wrap.appendChild(b);

  const tagList = document.createElement("div");
  tagList.className = "tag-list";

  function updateEmptyState() {
    const empty = tagList.querySelector(".tag-empty");
    if (cat[type].length === 0 && !empty) {
      const span = document.createElement("span");
      span.className = "tag-empty";
      span.textContent = "(없음)";
      tagList.appendChild(span);
    } else if (cat[type].length > 0 && empty) {
      empty.remove();
    }
  }

  function addTagEl(word) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = word;

    const x = document.createElement("button");
    x.type = "button";
    x.className = "tag-remove";
    x.textContent = "×";
    x.title = "삭제";
    x.addEventListener("click", () => {
      const idx = cat[type].indexOf(word);
      if (idx !== -1) cat[type].splice(idx, 1);
      save();
      tag.remove();
      updateEmptyState();
    });

    tag.appendChild(x);
    tagList.appendChild(tag);
  }

  words.forEach(addTagEl);
  updateEmptyState();
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
    const word = input.value.trim();
    input.value = "";
    input.focus();
    if (!word || cat[type].includes(word)) return;
    cat[type].push(word);
    save();
    addTagEl(word);
    updateEmptyState();
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

  if (!settings.categories.length) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.textContent = "카테고리가 없습니다. 아래에서 새 카테고리를 추가해보세요.";
    categoryList.appendChild(li);
    return;
  }

  settings.categories.forEach((cat) => {
    const li = document.createElement("li");

    const header = document.createElement("div");
    header.className = "cat-header";

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "cat-label-input";
    labelInput.value = cat.label;
    labelInput.addEventListener("change", () => {
      cat.label = labelInput.value.trim() || cat.label;
      labelInput.value = cat.label;
      save();
    });

    const controls = document.createElement("div");
    controls.className = "cat-controls";

    const enabledInput = document.createElement("input");
    enabledInput.type = "checkbox";
    enabledInput.checked = !!cat.enabled;
    enabledInput.title = "이 카테고리 사용";
    enabledInput.addEventListener("change", () => {
      cat.enabled = enabledInput.checked;
      save();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "cat-delete";
    deleteBtn.textContent = "🗑";
    deleteBtn.title = "카테고리 삭제";
    deleteBtn.addEventListener("click", () => removeCategory(cat));

    controls.appendChild(enabledInput);
    controls.appendChild(deleteBtn);

    header.appendChild(labelInput);
    header.appendChild(controls);

    const details = document.createElement("details");
    details.className = "cat-words";

    const summary = document.createElement("summary");
    summary.textContent = "단어 보기 / 추가·삭제";
    details.appendChild(summary);

    WORD_TYPES.forEach((t) => {
      details.appendChild(renderWordType(cat, t.key, t.title, t.cls, cat[t.key]));
    });

    li.appendChild(header);
    li.appendChild(details);
    categoryList.appendChild(li);
  });
}

addCategoryBtn.addEventListener("click", () => {
  addCategory(newCategoryInput.value);
  newCategoryInput.value = "";
});

newCategoryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addCategoryBtn.click();
});

resetAllBtn.addEventListener("click", resetAllCategories);
deleteAllBtn.addEventListener("click", deleteAllCategories);

exportBtn.addEventListener("click", exportCategories);
importBtn.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", () => {
  const file = importFileInput.files[0];
  if (file) importCategories(file);
  importFileInput.value = "";
});

masterToggle.addEventListener("change", () => {
  settings.enabled = masterToggle.checked;
  save();
});

displayModeBlur.addEventListener("change", () => {
  if (displayModeBlur.checked) {
    settings.displayMode = "blur";
    save();
  }
});

displayModeHide.addEventListener("change", () => {
  if (displayModeHide.checked) {
    settings.displayMode = "hide";
    save();
  }
});

function normalizeSiteInput(raw) {
  let s = (raw || "").trim();
  if (!s) return "";
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
      s = new URL(s).hostname;
    } else if (s.includes("/")) {
      s = s.split("/")[0];
    }
  } catch (e) {
    return "";
  }
  return s.toLowerCase().replace(/^www\./, "");
}

function updateExcludedEmptyState() {
  const empty = excludedSiteList.querySelector(".tag-empty");
  if (settings.excludedSites.length === 0 && !empty) {
    const span = document.createElement("span");
    span.className = "tag-empty";
    span.textContent = "(없음)";
    excludedSiteList.appendChild(span);
  } else if (settings.excludedSites.length > 0 && empty) {
    empty.remove();
  }
}

function addExcludedSiteTag(site) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = site;

  const x = document.createElement("button");
  x.type = "button";
  x.className = "tag-remove";
  x.textContent = "×";
  x.title = "삭제";
  x.addEventListener("click", () => {
    const idx = settings.excludedSites.indexOf(site);
    if (idx !== -1) settings.excludedSites.splice(idx, 1);
    save();
    tag.remove();
    updateExcludedEmptyState();
  });

  tag.appendChild(x);
  excludedSiteList.appendChild(tag);
}

function renderExcludedSites() {
  excludedSiteList.innerHTML = "";
  settings.excludedSites.forEach(addExcludedSiteTag);
  updateExcludedEmptyState();
}

function addExcludedSite(rawSite) {
  const site = normalizeSiteInput(rawSite);
  if (!site || settings.excludedSites.includes(site)) return;
  settings.excludedSites.push(site);
  save();
  addExcludedSiteTag(site);
  updateExcludedEmptyState();
}

addExcludedSiteBtn.addEventListener("click", () => {
  addExcludedSite(newExcludedSiteInput.value);
  newExcludedSiteInput.value = "";
  newExcludedSiteInput.focus();
});

newExcludedSiteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addExcludedSiteBtn.click();
});

addCurrentSiteBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs && tabs[0] && tabs[0].url;
    if (url) addExcludedSite(url);
  });
});

chrome.storage.sync.get(STORAGE_KEY, (data) => {
  settings = HSF_normalizeSettings(data[STORAGE_KEY]);
  masterToggle.checked = settings.enabled;
  displayModeBlur.checked = settings.displayMode === "blur";
  displayModeHide.checked = settings.displayMode === "hide";
  renderCategories();
  renderExcludedSites();
});
