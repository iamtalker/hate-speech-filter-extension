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

  function start(settings) {
    if (!settings.enabled) return;
    const rules = compileRules(settings);
    if (!rules.length) return;
    const mode = settings.displayMode;

    scan(document.body, rules, mode);

    const observer = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType === 1) scan(node, rules, mode);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    const settings = HSF_normalizeSettings(data[STORAGE_KEY]);
    if (HSF_isHostExcluded(location.hostname, settings.excludedSites)) return;
    start(settings);
  });
})();
