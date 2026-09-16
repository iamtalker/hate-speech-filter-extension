(function () {
  const STORAGE_KEY = "hsfSettings";
  const DEFAULT_SETTINGS = {
    enabled: true,
    categories: { region: true, gender: true, nationality: true, disability: false },
    customWords: []
  };

  const BLOCK_SELECTOR = "p, li, div, span, td, th, blockquote, h1, h2, h3, h4, h5, h6, article, dd, dt";

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
    for (const [cat, data] of Object.entries(HSF_DEFAULT_WORDLISTS)) {
      if (!settings.categories[cat]) continue;
      rules.push({
        cat,
        label: data.label,
        explicit: buildRegex(data.explicitSlurs),
        group: buildRegex(data.groupTerms),
        ambiguous: buildRegex(data.ambiguousSlurs)
      });
    }
    if (settings.customWords && settings.customWords.length) {
      rules.push({
        cat: "custom",
        label: "사용자 지정",
        explicit: buildRegex(settings.customWords),
        group: null,
        ambiguous: null
      });
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

  function isLeafBlock(el) {
    return !el.querySelector(BLOCK_SELECTOR);
  }

  function isInIgnoredContext(el) {
    return !!el.closest("script, style, textarea, input, [contenteditable], .hsf-badge");
  }

  function applyBlur(el, rule) {
    if (el.dataset.hsfBlurred) return;

    const inner = document.createElement("span");
    inner.className = "hsf-inner hsf-hidden-content";
    while (el.firstChild) inner.appendChild(el.firstChild);

    const badge = document.createElement("span");
    badge.className = "hsf-badge";
    badge.textContent = "🙈 혜오표현 감지(" + rule.label + ") · 클릭하여 보기";
    badge.addEventListener("click", function (ev) {
      ev.stopPropagation();
      const hidden = inner.classList.toggle("hsf-hidden-content");
      badge.classList.toggle("hsf-badge-active", !hidden);
    });

    el.appendChild(badge);
    el.appendChild(inner);
    el.dataset.hsfBlurred = "1";
  }

  function scan(root, rules) {
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
      if (rule) applyBlur(el, rule);
    }
  }

  function start(settings) {
    if (!settings.enabled) return;
    const rules = compileRules(settings);
    if (!rules.length) return;

    scan(document.body, rules);

    const observer = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType === 1) scan(node, rules);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    const stored = data[STORAGE_KEY] || {};
    const settings = {
      enabled: stored.enabled !== undefined ? stored.enabled : DEFAULT_SETTINGS.enabled,
      categories: Object.assign({}, DEFAULT_SETTINGS.categories, stored.categories || {}),
      customWords: stored.customWords || DEFAULT_SETTINGS.customWords
    };
    start(settings);
  });
})();
