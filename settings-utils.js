// 설정(chrome.storage) 정규화 및 기본 단어 목록 + 사용자 수정 사항 병합 유틸리티.
// content.js, popup.js, background.js에서 공통으로 사용한다.

const HSF_DEFAULT_SETTINGS = {
  enabled: true,
  categories: { region: true, gender: true, nationality: true, disability: false },
  overrides: {},
  customWords: []
};

function HSF_emptyOverride() {
  return { added: { groupTerms: [], explicitSlurs: [], ambiguousSlurs: [] }, removed: [] };
}

// 저장된 설정에 새 카테고리/필드가 없어도 안전하게 기본값과 병합한다.
function HSF_normalizeSettings(stored) {
  stored = stored || {};
  const categories = Object.assign({}, HSF_DEFAULT_SETTINGS.categories, stored.categories || {});

  const overrides = {};
  for (const cat of Object.keys(HSF_DEFAULT_WORDLISTS)) {
    const empty = HSF_emptyOverride();
    const src = (stored.overrides && stored.overrides[cat]) || {};
    const srcAdded = src.added || {};
    overrides[cat] = {
      added: {
        groupTerms: srcAdded.groupTerms || empty.added.groupTerms,
        explicitSlurs: srcAdded.explicitSlurs || empty.added.explicitSlurs,
        ambiguousSlurs: srcAdded.ambiguousSlurs || empty.added.ambiguousSlurs
      },
      removed: src.removed || empty.removed
    };
  }

  return {
    enabled: stored.enabled !== undefined ? stored.enabled : HSF_DEFAULT_SETTINGS.enabled,
    categories,
    overrides,
    customWords: stored.customWords || []
  };
}

function HSF_mergeList(defaultList, addedList, removedSet) {
  const seen = new Set();
  const merged = [];
  for (const w of [...defaultList, ...(addedList || [])]) {
    if (!w || removedSet.has(w) || seen.has(w)) continue;
    seen.add(w);
    merged.push(w);
  }
  return merged;
}

// 카테고리별 기본 목록 + 사용자가 추가한 단어 - 사용자가 삭제한 기본 단어를 합쳐서 반환.
function HSF_getMergedLists(cat, overrides) {
  const data = HSF_DEFAULT_WORDLISTS[cat];
  const ov = (overrides && overrides[cat]) || HSF_emptyOverride();
  const removed = new Set(ov.removed || []);
  return {
    groupTerms: HSF_mergeList(data.groupTerms, ov.added.groupTerms, removed),
    explicitSlurs: HSF_mergeList(data.explicitSlurs, ov.added.explicitSlurs, removed),
    ambiguousSlurs: HSF_mergeList(data.ambiguousSlurs, ov.added.ambiguousSlurs, removed)
  };
}
