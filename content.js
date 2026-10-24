(function () {
  const STORAGE_KEY = "hsfSettings";

  const BLOCK_SELECTOR = "p, li, div, span, a, td, th, blockquote, h1, h2, h3, h4, h5, h6, article, dd, dt";

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildRegex(words) {
    const list = (words || []).filter(Boolean);
    if (!list.length) return null;
    return new RegExp(list.map(escapeRegex).join("|"), "i");
  }

  function compileRules(settings) {
    const rules = [];
    for (const cat of settings.categories) {
      if (!cat.enabled) continue;
      const explicit = buildRegex(cat.explicitSlurs);
      const group = buildRegex(cat.groupTerms);
      const ambiguous = buildRegex(cat.ambiguousSlurs);
      if (!explicit && !(group && ambiguous)) continue;
      rules.push({ label: cat.label, explicit, group, ambiguous });
    }
    return rules;
  }

  function testMatch(text, rules) {
    for (const r of rules) {
      if (r.explicit && r.explicit.test(text)) return r;
      if (r.group && r.ambiguous && r.group.test(text) && r.ambiguous.test(text)) return r;
    }
    return null;
  }

  // 자기 자신에게 직접 딸린(자식 요소가 아닌) 텍스트 노드가 있는지 확인한다.
  function hasOwnText(el) {
    for (const node of el.childNodes) {
      if (node.nodeType === 3 && node.nodeValue.trim().length > 0) return true;
    }
    return false;
  }

  // 검사 대상으로 삼을 "리프 블록"인지 판단한다.
  // 내부에 다른 블록 요소(span, a 등)가 있어도, 그것과 별개로 자기 자신 소유의
  // 텍스트가 있다면(예: <a class="title"><span>[짤방]</span>제목 텍스트</a>의
  // "제목 텍스트" 부분) 통째로 검사해야 그 텍스트가 누락되지 않는다.
  function isLeafBlock(el) {
    return !el.querySelector(BLOCK_SELECTOR) || hasOwnText(el);
  }

  function isInIgnoredContext(el) {
    return !!el.closest("script, style, textarea, input, [contenteditable], .hsf-badge, .hsf-inner");
  }

  function applyBlur(el, rule, mode) {
    if (el.dataset.hsfBlurred) return;

    if (mode === "remove") {
      el.classList.add("hsf-removed");
      el.dataset.hsfBlurred = "1";
      return;
    }

    const hiddenClass = mode === "hide" ? "hsf-hidden-full" : "hsf-hidden-content";

    const inner = document.createElement("span");
    inner.className = "hsf-inner " + hiddenClass;
    inner.dataset.hsfProcessed = "1";
    while (el.firstChild) inner.appendChild(el.firstChild);

    const badge = document.createElement("span");
    badge.className = "hsf-badge";
    badge.dataset.hsfProcessed = "1";
    badge.textContent = "🙈 혐오표현 감지(" + rule.label + ") · 클릭하여 보기";
    badge.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const hidden = inner.classList.toggle(hiddenClass);
      badge.classList.toggle("hsf-badge-active", !hidden);
    });

    el.appendChild(badge);
    el.appendChild(inner);
    el.dataset.hsfBlurred = "1";
  }

  function scan(root, rules, mode) {
    if (!root || !root.querySelectorAll) return;
    const candidates = root.matches && root.matches(BLOCK_SELECTOR) ? [root] : [];
    candidates.push(...root.querySelectorAll(BLOCK_SELECTOR));

    for (const el of candidates) {
      if (el.dataset.hsfProcessed) continue;
      if (!isLeafBlock(el)) continue;
      if (isInIgnoredContext(el)) continue;

      const text = (el.innerText || el.textContent || "").trim();
      el.dataset.hsfProcessed = "1";
      if (text.length < 2 || text.length > 4000) continue;

      const rule = testMatch(text, rules);
      if (rule) applyBlur(el, rule, mode);
    }
  }

  // 링크/닉네임이 속한 "목록의 한 줄"을 찾는다. 레이아웃용 표처럼 너무 큰 덩어리면 null.
  const MAX_ROW_LINKS = 20;
  function findRow(el) {
    const row = el.closest("tr, li, article");
    if (!row || row.querySelectorAll("a[href]").length > MAX_ROW_LINKS) return null;
    return row;
  }

  function hideRow(row) {
    row.classList.add("hsf-removed");
  }

  // 차단한 게시판으로 가는 링크, 차단한 닉네임이 적힌 요소가 있으면 그 줄을 통째로 숨긴다.
  function scanBlocked(root, blockedPages, nicknames) {
    if (!root || !root.querySelectorAll) return;

    if (blockedPages.length) {
      const links = root.matches && root.matches("a[href]") ? [root] : [];
      links.push(...root.querySelectorAll("a[href]"));
      for (const a of links) {
        if (a.dataset.hsfLinkChecked) continue;
        a.dataset.hsfLinkChecked = "1";
        let url;
        try { url = new URL(a.href, location.href); } catch (e) { continue; }
        if (!HSF_isUrlBlocked(url, blockedPages)) continue;
        hideRow(findRow(a) || a);
      }
    }

    if (nicknames.size) {
      const els = root.matches && root.matches(BLOCK_SELECTOR) ? [root] : [];
      els.push(...root.querySelectorAll(BLOCK_SELECTOR));
      for (const el of els) {
        if (el.dataset.hsfNickChecked || el.children.length > 2) continue;
        el.dataset.hsfNickChecked = "1";
        if (!nicknames.has((el.textContent || "").trim().toLowerCase())) continue;
        const row = findRow(el);
        if (row) hideRow(row);
      }
    }
  }

  // 차단한 페이지에 직접 들어왔을 때 화면 전체를 덮는다. "그래도 보기"로 이번 한 번만 열 수 있다.
  function showPageBlock() {
    const cover = document.createElement("div");
    cover.className = "hsf-page-block";
    cover.dataset.hsfProcessed = "1";
    const box = document.createElement("div");
    const msg = document.createElement("p");
    msg.textContent = "🙈 차단한 페이지입니다.";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "그래도 보기";
    btn.addEventListener("click", () => cover.remove());
    box.appendChild(msg);
    box.appendChild(btn);
    cover.appendChild(box);
    document.documentElement.appendChild(cover);
  }

  function start(settings) {
    if (!settings.enabled) return;
    const rules = compileRules(settings);
    const blockedPages = settings.blockedPages;
    const nicknames = new Set(settings.blockedNicknames.map((n) => n.toLowerCase()));
    const hasBlocking = blockedPages.length > 0 || nicknames.size > 0;
    if (!rules.length && !hasBlocking) return;
    const mode = settings.displayMode;

    if (HSF_isUrlBlocked(location, blockedPages)) showPageBlock();

    function scanAll(root) {
      if (hasBlocking) scanBlocked(root, blockedPages, nicknames);
      if (rules.length) scan(root, rules, mode);
    }

    scanAll(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType === 1) scanAll(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    const settings = HSF_normalizeSettings(data[STORAGE_KEY]);
    if (HSF_isPageExcluded(location, settings.excludedSites)) return;
    start(settings);
  });
})();
