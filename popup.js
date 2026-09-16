const STORAGE_KEY = "hsfSettings";

const WORD_TYPES = [
  { key: "groupTerms", title: "집단 식별어 (단독으로는 차단 안 함)", cls: "wg-group" },
  { key: "explicitSlurs", title: "명백한 멸칭 (즉시 차단)", cls: "wg-explicit" },
  { key: "ambiguousSlurs", title: "모호한 표현 (집단어와 같이 나올 때만 차단)", cls: "wg-ambiguous" }
];

let settings = { enabled: true, categories: [] };

const masterToggle = document.getElementById("masterToggle");
const categoryList = document.getElementById("categoryList");
const resetAllBtn = document.getElementById("resetAllBtn");
const newCategoryInput = document.getElementById("newCategoryInput");
const addCategoryBtn = document.getElementById("addCategoryBtn");

function save() {
  chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

function removeWord(cat, type, word) {
  const idx = cat[type].indexOf(word);
  if (idx !== -1) cat[type].splice(idx, 1);
  save();
  renderCategories();
}

function addWord(cat, type, rawWord) {
  const word = rawWord.trim();
  if (!word) return;
  if (!cat[type].includes(word)) cat[type].push(word);
  save();
  renderCategories();
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

masterToggle.addEventListener("change", () => {
  settings.enabled = masterToggle.checked;
  save();
});

chrome.storage.sync.get(STORAGE_KEY, (data) => {
  settings = HSF_normalizeSettings(data[STORAGE_KEY]);
  masterToggle.checked = settings.enabled;
  renderCategories();
});
