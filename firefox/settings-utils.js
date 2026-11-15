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
//   blockedPages: ["todayhumor.co.kr/board/list.php?table=sisa", ...],  // 제외 목록과 같은 형식. 해당 페이지는 가려지고, 다른 페이지에 있는 그 주소로의 링크(글 목록의 줄)는 숨겨진다
//   blockedNicknames: ["닉네임", ...],  // 작성자 이름이 정확히 일치하는 글/댓글의 줄을 숨긴다
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

function HSF_sanitizeNicknames(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((n) => String(n || "").trim()).filter(Boolean))];
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
      blockedPages: HSF_sanitizeExcludedSites(stored.blockedPages),
      blockedNicknames: HSF_sanitizeNicknames(stored.blockedNicknames),
      displayMode: HSF_sanitizeDisplayMode(stored.displayMode)
    };
  }

  if (!Array.isArray(stored.categories)) {
    const migrated = HSF_migrateLegacySettings(stored);
    migrated.excludedSites = HSF_sanitizeExcludedSites(stored.excludedSites);
    migrated.blockedPages = HSF_sanitizeExcludedSites(stored.blockedPages);
    migrated.blockedNicknames = HSF_sanitizeNicknames(stored.blockedNicknames);
    migrated.displayMode = HSF_sanitizeDisplayMode(stored.displayMode);
    return migrated;
  }

  return {
    enabled: stored.enabled !== undefined ? stored.enabled : true,
    categories: stored.categories.map(HSF_sanitizeCategory),
    excludedSites: HSF_sanitizeExcludedSites(stored.excludedSites),
    blockedPages: HSF_sanitizeExcludedSites(stored.blockedPages),
    blockedNicknames: HSF_sanitizeNicknames(stored.blockedNicknames),
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

// 주소(location 또는 URL)가 항목 하나에 걸리는지 확인한다.
// - 호스트: 등록한 도메인과 그 서브도메인 모두 해당
// - 경로: 등록한 경로와 그 하위 경로 모두 해당 (경로를 안 적으면 사이트 전체)
// - 검색조건: 적힌 key=value가 전부 현재 주소에 있어야 해당 (순서, 다른 값은 무관)
// - ignorePathWithQuery: 검색조건이 적힌 항목은 경로를 비교하지 않는다. 게시판 목록(list.php?table=x)을
//   등록해도 그 게시판의 글(view.php?table=x&no=1) 주소가 같은 게시판으로 인식되게 하기 위함이다.
function HSF_urlMatchesEntry(url, entry, ignorePathWithQuery) {
  const h = url.hostname.toLowerCase();
  const { host, path, query } = HSF_parseExcludeEntry(entry);
  if (!host || !(h === host || h.endsWith("." + host))) return false;

  if (path && !(ignorePathWithQuery && query) &&
      !(url.pathname === path || url.pathname.startsWith(path + "/"))) return false;

  if (query) {
    const current = new URLSearchParams(url.search);
    for (const [key, value] of new URLSearchParams(query)) {
      if (!current.getAll(key).includes(value)) return false;
    }
  }
  return true;
}

// 현재 페이지(location)가 제외 목록에 걸리는지 확인한다.
function HSF_isPageExcluded(loc, excludedSites) {
  if (!loc || !loc.hostname || !excludedSites || !excludedSites.length) return false;
  return excludedSites.some((entry) => HSF_urlMatchesEntry(loc, entry, false));
}

// 주소(location 또는 URL)가 차단 목록에 걸리는지 확인한다. 게시판 단위 차단이라 경로 비교를 느슨하게 한다.
function HSF_isUrlBlocked(url, blockedPages) {
  if (!url || !url.hostname || !blockedPages || !blockedPages.length) return false;
  return blockedPages.some((entry) => HSF_urlMatchesEntry(url, entry, true));
}
