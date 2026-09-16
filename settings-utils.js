// 설정(chrome.storage) 정규화 유틸리티. content.js, popup.js, background.js에서 공통으로 사용한다.
//
// 저장 형식 (v1.2.0+):
// {
//   enabled: boolean,
//   categories: [
//     { id, label, enabled, groupTerms: [], explicitSlurs: [], ambiguousSlurs: [] },
//     ...
//   ]
// }
//
// 카테고리는 더 이상 코드에 고정되어 있지 않고 전부 저장된 데이터다.
// wordlists.js의 HSF_DEFAULT_WORDLISTS는 최초 설치 시 시드(seed) 데이터로만 쓰인다.

function HSF_genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "cat_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function HSF_buildDefaultCategories() {
  return Object.entries(HSF_DEFAULT_WORDLISTS).map(([id, data]) => ({
    id,
    label: data.label,
    enabled: id !== "disability",
    groupTerms: data.groupTerms.slice(),
    explicitSlurs: data.explicitSlurs.slice(),
    ambiguousSlurs: data.ambiguousSlurs.slice()
  }));
}

function HSF_sanitizeCategory(c) {
  return {
    id: (c && c.id) || HSF_genId(),
    label: (c && c.label) || "(이름 없음)",
    enabled: c && c.enabled !== undefined ? !!c.enabled : true,
    groupTerms: Array.isArray(c && c.groupTerms) ? c.groupTerms : [],
    explicitSlurs: Array.isArray(c && c.explicitSlurs) ? c.explicitSlurs : [],
    ambiguousSlurs: Array.isArray(c && c.ambiguousSlurs) ? c.ambiguousSlurs : []
  };
}

// v1.1.0 이하(고정 카테고리 + overrides + customWords)에서 저장된 데이터를
// 새로운 자유 카테고리 배열 형식으로 변환한다.
function HSF_migrateLegacySettings(stored) {
  const legacyCategories = stored.categories || {};
  const legacyOverrides = stored.overrides || {};
  const categories = [];

  for (const [id, data] of Object.entries(HSF_DEFAULT_WORDLISTS)) {
    const ov = legacyOverrides[id] || { added: {}, removed: [] };
    const added = ov.added || {};
    const removed = new Set(ov.removed || []);

    function merge(defaultList, addedList) {
      const seen = new Set();
      const out = [];
      for (const w of [...defaultList, ...(addedList || [])]) {
        if (!w || removed.has(w) || seen.has(w)) continue;
        seen.add(w);
        out.push(w);
      }
      return out;
    }

    categories.push({
      id,
      label: data.label,
      enabled: legacyCategories[id] !== undefined ? !!legacyCategories[id] : true,
      groupTerms: merge(data.groupTerms, added.groupTerms),
      explicitSlurs: merge(data.explicitSlurs, added.explicitSlurs),
      ambiguousSlurs: merge(data.ambiguousSlurs, added.ambiguousSlurs)
    });
  }

  if (stored.customWords && stored.customWords.length) {
    categories.push({
      id: "custom",
      label: "사용자 지정",
      enabled: true,
      groupTerms: [],
      explicitSlurs: stored.customWords.slice(),
      ambiguousSlurs: []
    });
  }

  return {
    enabled: stored.enabled !== undefined ? stored.enabled : true,
    categories
  };
}

function HSF_normalizeSettings(stored) {
  stored = stored || {};

  if (!stored.categories) {
    return { enabled: true, categories: HSF_buildDefaultCategories() };
  }

  if (!Array.isArray(stored.categories)) {
    return HSF_migrateLegacySettings(stored);
  }

  return {
    enabled: stored.enabled !== undefined ? stored.enabled : true,
    categories: stored.categories.map(HSF_sanitizeCategory)
  };
}
