// 설정(chrome.storage) 정규화 유틸리티. content.js, popup.js, background.js에서 공통으로 사용한다.
//
// 저장 형식 (v1.6.0+):
// {
//   enabled: boolean,
//   categories: [
//     { id, label, enabled, groupTerms: [], explicitSlurs: [], ambiguousSlurs: [] },
//     ...
//   ],
//   excludedSites: ["example.com", "example.com/board?id=3", ...],  // "host[/path][?query]" 형식. 해당하는 사이트/페이지에서는 아예 동작하지 않음
//   displayMode: "blur" | "hide" | "remove"  // 감지된 글을 블러 처리 / 완전히 숨김(배지로 복구 가능) / 완전 삭제(배지도 없음, 복구 불가)
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

function HSF_sanitizeExcludedSites(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const trimmed = String(raw || "").trim();
    const cut = trimmed.search(/[/?]/);
    const host = (cut === -1 ? trimmed : trimmed.slice(0, cut)).toLowerCase();
    const site = host + (cut === -1 ? "" : trimmed.slice(cut));
    if (!host || seen.has(site)) continue;
    seen.add(site);
    out.push(site);
  }
  return out;
}

function HSF_sanitizeDisplayMode(mode) {
  return mode === "hide" || mode === "remove" ? mode : "blur";
}

function HSF_normalizeSettings(stored) {
  stored = stored || {};

  if (!stored.categories) {
    return {
      enabled: true,
      categories: HSF_buildDefaultCategories(),
      excludedSites: HSF_sanitizeExcludedSites(stored.excludedSites),
      displayMode: HSF_sanitizeDisplayMode(stored.displayMode)
    };
  }

  if (!Array.isArray(stored.categories)) {
    const migrated = HSF_migrateLegacySettings(stored);
    migrated.excludedSites = HSF_sanitizeExcludedSites(stored.excludedSites);
    migrated.displayMode = HSF_sanitizeDisplayMode(stored.displayMode);
    return migrated;
  }

  return {
    enabled: stored.enabled !== undefined ? stored.enabled : true,
    categories: stored.categories.map(HSF_sanitizeCategory),
    excludedSites: HSF_sanitizeExcludedSites(stored.excludedSites),
    displayMode: HSF_sanitizeDisplayMode(stored.displayMode)
  };
}

// 제외 항목 "host[/path][?query]"를 나눈다.
function HSF_parseExcludeEntry(entry) {
  const q = entry.indexOf("?");
  const base = q === -1 ? entry : entry.slice(0, q);
  const query = q === -1 ? "" : entry.slice(q + 1);
  const s = base.indexOf("/");
  return {
    host: s === -1 ? base : base.slice(0, s),
    path: s === -1 ? "" : base.slice(s).replace(/\/+$/, ""),
    query
  };
}

// 현재 페이지(location)가 제외 목록에 걸리는지 확인한다.
// - 호스트: 등록한 도메인과 그 서브도메인 모두 해당
// - 경로: 등록한 경로와 그 하위 경로 모두 해당 (경로를 안 적으면 사이트 전체)
// - 검색조건: 적힌 key=value가 전부 현재 주소에 있어야 해당 (순서, 다른 값은 무관)
function HSF_isPageExcluded(loc, excludedSites) {
  if (!loc || !loc.hostname || !excludedSites || !excludedSites.length) return false;
  const h = loc.hostname.toLowerCase();

  return excludedSites.some((entry) => {
    const { host, path, query } = HSF_parseExcludeEntry(entry);
    if (!host || !(h === host || h.endsWith("." + host))) return false;

    if (path && !(loc.pathname === path || loc.pathname.startsWith(path + "/"))) return false;

    if (query) {
      const current = new URLSearchParams(loc.search);
      for (const [key, value] of new URLSearchParams(query)) {
        if (!current.getAll(key).includes(value)) return false;
      }
    }
    return true;
  });
}
