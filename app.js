/* ============================================================
   looptrace — app wiring. No inline handlers (strict CSP).
   Reads SNIPPETS (data/snippets.js) and the scheduler model
   (data/model.js) as globals. All state is local; the only
   persistence is the predict-mode streak in localStorage.
   ============================================================ */

'use strict';

/* global SNIPPETS, traceSnippet */

(function () {
  var $ = function (id) { return document.getElementById(id); };

  var TOPICS = ['all', 'stack', 'timeout', 'then-chain', 'microtask', 'async-await', 'mixed'];
  var LS_THEME = 'looptrace.theme';
  var LS_STREAK = 'looptrace.streak';
  var LS_BEST = 'looptrace.best';

  var state = {
    topic: 'all',
    snippet: null,
    steps: [],
    idx: 0,
    playing: null,
    predictMode: false,
    pool: [],       // [{text, taken}]
    choice: [],     // indexes into pool
  };

  /* ---------- tiny deterministic PRNG (djb2 → mulberry32) ---------- */
  function djb2(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h;
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seededShuffle(arr, seedStr) {
    var rnd = mulberry32(djb2(seedStr));
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* ---------- theme ---------- */
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    var effectiveDark = t === 'dark' ||
      (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var btn = $('themeToggle');
    btn.textContent = effectiveDark ? 'Light mode' : 'Dark mode';
    btn.setAttribute('aria-pressed', String(effectiveDark));
  }
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(LS_THEME); } catch (e) { /* private mode */ }
    applyTheme(saved);
    $('themeToggle').addEventListener('click', function () {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.hasAttribute('data-theme') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      var next = isDark ? 'light' : 'dark';
      try { localStorage.setItem(LS_THEME, next); } catch (e) { /* ignore */ }
      applyTheme(next);
    });
  }

  /* ---------- picker ---------- */
  function buildFilters() {
    var host = $('topicFilters');
    TOPICS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'filter';
      b.textContent = t;
      b.setAttribute('aria-pressed', String(t === state.topic));
      b.addEventListener('click', function () {
        state.topic = t;
        Array.prototype.forEach.call(host.children, function (c) {
          c.setAttribute('aria-pressed', String(c.textContent === t));
        });
        buildList();
      });
      host.appendChild(b);
    });
  }

  function buildList() {
    var host = $('snippetList');
    host.textContent = '';
    SNIPPETS.filter(function (s) {
      return state.topic === 'all' || s.topic === state.topic;
    }).forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'snip';
      b.setAttribute('aria-current', String(state.snippet && state.snippet.id === s.id));
      var t = document.createElement('span');
      t.className = 'snip__title';
      t.textContent = s.title;
      var m = document.createElement('span');
      m.className = 'snip__meta';
      m.textContent = s.topic + ' · ' + '●'.repeat(s.difficulty) + '○'.repeat(3 - s.difficulty);
      b.appendChild(t); b.appendChild(m);
      b.addEventListener('click', function () { selectSnippet(s.id, true); });
      host.appendChild(b);
    });
  }

  /* ---------- selection + trace ---------- */
  function selectSnippet(id, pushHash) {
    var s = null;
    for (var i = 0; i < SNIPPETS.length; i++) if (SNIPPETS[i].id === id) s = SNIPPETS[i];
    if (!s) s = SNIPPETS[0];
    state.snippet = s;
    stopPlay();

    var trace = traceSnippet(s.id);
    var initial = {
      phase: 'script', caption: 'Ready. Press next ▸ (or →) to run the first step.',
      stack: [], micro: [], macro: [], console: [],
    };
    state.steps = [initial].concat(trace.steps);
    state.idx = 0;

    if (pushHash && window.location.hash !== '#' + s.id) {
      window.location.hash = s.id;
    }

    $('snippetTitle').textContent = s.title;
    $('snippetTopic').textContent = s.topic;
    $('snippetDifficulty').textContent = '●'.repeat(s.difficulty) + '○'.repeat(3 - s.difficulty);
    $('snippetCode').textContent = s.code;

    var badge = $('verifiedBadge');
    badge.textContent = '';
    badge.appendChild(document.createTextNode('✓ Console order verified against Node ' + s.verifiedNode + ', ' + s.verifiedDate + ' · '));
    var cite = document.createElement('a');
    cite.href = s.cite.url;
    cite.rel = 'external';
    cite.textContent = s.cite.label;
    badge.appendChild(cite);

    var rb = $('ruleBox');
    rb.textContent = '';
    var strong = document.createElement('strong');
    strong.textContent = 'The rule this shows: ';
    rb.appendChild(strong);
    rb.appendChild(document.createTextNode(s.rule));

    resetPredict();
    buildList();
    render();
    buildPrintout();
  }

  /* ---------- rendering ---------- */
  function fillList(host, items, opts) {
    host.textContent = '';
    if (items.length === 0) {
      var li = document.createElement('li');
      li.className = 'empty';
      li.textContent = opts.emptyText;
      host.appendChild(li);
      return;
    }
    items.forEach(function (name, i) {
      var el = document.createElement('li');
      if (opts.running && i === 0) {
        el.className = 'running';
        el.textContent = name + '  ◀ running';
      } else if (opts.numbered) {
        el.textContent = (i + 1) + '. ' + name;
      } else {
        el.textContent = name;
      }
      host.appendChild(el);
    });
  }

  var DIAL_POS = { script: [120, 25], micro: [440, 25], macro: [280, 125], idle: [120, 25] };
  var PHASE_LABEL = {
    script: 'phase: run script',
    micro: 'phase: drain microtasks',
    macro: 'phase: next macrotask',
    idle: 'phase: idle — done',
  };

  function render() {
    var st = state.steps[state.idx];
    var s = state.snippet;

    // caption (corpus override wins if authored)
    var override = (state.idx > 0 && s.stepCaptions && s.stepCaptions.length > 0)
      ? s.stepCaptions[state.idx - 1] : null;
    var cap = $('stepCaption');
    cap.textContent = '';
    var num = document.createElement('strong');
    num.textContent = state.idx === 0 ? '' : 'Step ' + state.idx + ': ';
    cap.appendChild(num);
    cap.appendChild(document.createTextNode(override || st.caption));

    // panels
    fillList($('stackPanel'), st.stack.slice().reverse(), { running: st.stack.length > 0, emptyText: '(stack empty)' });
    fillList($('microPanel'), st.micro, { numbered: true, emptyText: '(no microtasks)' });
    fillList($('macroPanel'), st.macro, { numbered: true, emptyText: '(no macrotasks)' });
    fillList($('consolePanel'), st.console, { emptyText: '(nothing printed yet)' });

    // dial
    var pos = DIAL_POS[st.phase] || DIAL_POS.script;
    var dot = $('dialDot');
    dot.setAttribute('cx', String(pos[0]));
    dot.setAttribute('cy', String(pos[1]));
    dot.classList.toggle('idle', st.phase === 'idle');
    $('stScript').classList.toggle('active', st.phase === 'script');
    $('stMicro').classList.toggle('active', st.phase === 'micro');
    $('stMacro').classList.toggle('active', st.phase === 'macro');
    $('dialPhase').textContent = PHASE_LABEL[st.phase] || st.phase;

    $('stepCount').textContent = 'step ' + state.idx + ' / ' + (state.steps.length - 1);
    $('btnPrev').disabled = state.idx === 0;
    $('btnNext').disabled = state.idx >= state.steps.length - 1;
  }

  /* ---------- player controls ---------- */
  function stepTo(i) {
    state.idx = Math.max(0, Math.min(state.steps.length - 1, i));
    render();
  }
  function stopPlay() {
    if (state.playing) {
      clearInterval(state.playing);
      state.playing = null;
      $('btnPlay').setAttribute('aria-pressed', 'false');
      $('btnPlay').textContent = '▸▸ Autoplay';
    }
  }
  function togglePlay() {
    if (state.playing) { stopPlay(); return; }
    if (state.idx >= state.steps.length - 1) stepTo(0);
    state.playing = setInterval(function () {
      if (state.idx >= state.steps.length - 1) { stopPlay(); return; }
      stepTo(state.idx + 1);
    }, 1100);
    $('btnPlay').setAttribute('aria-pressed', 'true');
    $('btnPlay').textContent = '⏸ Pause';
  }

  function initControls() {
    $('btnNext').addEventListener('click', function () { stopPlay(); stepTo(state.idx + 1); });
    $('btnPrev').addEventListener('click', function () { stopPlay(); stepTo(state.idx - 1); });
    $('btnReset').addEventListener('click', function () { stopPlay(); stepTo(0); });
    $('btnPlay').addEventListener('click', togglePlay);
    document.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
      if (e.key === 'ArrowRight') { stopPlay(); stepTo(state.idx + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { stopPlay(); stepTo(state.idx - 1); e.preventDefault(); }
    });
  }

  /* ---------- predict-first mode ---------- */
  function readStreak() {
    var s = 0; var b = 0;
    try {
      s = parseInt(localStorage.getItem(LS_STREAK) || '0', 10) || 0;
      b = parseInt(localStorage.getItem(LS_BEST) || '0', 10) || 0;
    } catch (e) { /* ignore */ }
    return { streak: s, best: b };
  }
  function writeStreak(s, b) {
    try {
      localStorage.setItem(LS_STREAK, String(s));
      localStorage.setItem(LS_BEST, String(b));
    } catch (e) { /* ignore */ }
  }
  function renderStreak() {
    var v = readStreak();
    $('streakBox').textContent = 'streak: ' + v.streak + ' · best: ' + v.best;
  }

  function resetPredict() {
    var s = state.snippet;
    state.pool = seededShuffle(s.expectedOrder, s.id).map(function (t) {
      return { text: t, taken: false };
    });
    state.choice = [];
    $('predictResult').textContent = '';
    $('predictResult').className = 'predict__result';
    renderPredict();
    renderStreak();
  }

  function renderPredict() {
    var pool = $('predictPool');
    pool.textContent = '';
    state.pool.forEach(function (item, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = item.text;
      b.disabled = item.taken;
      b.addEventListener('click', function () {
        item.taken = true;
        state.choice.push(i);
        renderPredict();
      });
      pool.appendChild(b);
    });
    var choice = $('predictChoice');
    choice.textContent = '';
    state.choice.forEach(function (poolIdx, pos) {
      var li = document.createElement('li');
      li.appendChild(document.createTextNode(state.pool[poolIdx].text + ' '));
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'chip';
      rm.textContent = '× remove';
      rm.setAttribute('aria-label', 'Remove ' + state.pool[poolIdx].text + ' from position ' + (pos + 1));
      rm.addEventListener('click', function () {
        state.pool[poolIdx].taken = false;
        state.choice.splice(pos, 1);
        renderPredict();
      });
      li.appendChild(rm);
      choice.appendChild(li);
    });
  }

  function revealPredict() {
    var s = state.snippet;
    var res = $('predictResult');
    if (state.choice.length !== s.expectedOrder.length) {
      res.className = 'predict__result';
      res.textContent = 'Place all ' + s.expectedOrder.length + ' lines first (' + state.choice.length + ' placed).';
      return;
    }
    var guess = state.choice.map(function (i) { return state.pool[i].text; });
    var ok = guess.join(' ') === s.expectedOrder.join(' ');
    var v = readStreak();
    if (ok) {
      v.streak += 1;
      if (v.streak > v.best) v.best = v.streak;
      res.className = 'predict__result good';
      res.textContent = '✓ Correct — verified order: ' + s.expectedOrder.join(' → ') + '. Now step through to see WHY.';
    } else {
      v.streak = 0;
      res.className = 'predict__result bad';
      res.textContent = '✗ Not quite. Real (Node-verified) order: ' + s.expectedOrder.join(' → ') + '. Step through to see why, then try the next one.';
    }
    writeStreak(v.streak, v.best);
    renderStreak();
  }

  function initPredict() {
    $('predictToggle').addEventListener('click', function () {
      state.predictMode = !state.predictMode;
      this.setAttribute('aria-pressed', String(state.predictMode));
      $('predictPanel').hidden = !state.predictMode;
      if (state.predictMode) resetPredict();
    });
    $('predictReveal').addEventListener('click', revealPredict);
    $('predictClear').addEventListener('click', resetPredict);
  }

  /* ---------- export: markdown + print ---------- */
  function buildMarkdown() {
    var s = state.snippet;
    var t = traceSnippet(s.id);
    var lines = [];
    lines.push('# looptrace — ' + s.title);
    lines.push('');
    lines.push('Topic: ' + s.topic + ' · difficulty ' + s.difficulty + '/3');
    lines.push('');
    lines.push('```js');
    lines.push(s.code);
    lines.push('```');
    lines.push('');
    lines.push('| # | phase | what happens | stack (top first) | microtasks | macrotasks | console |');
    lines.push('|---|-------|--------------|-------------------|------------|------------|---------|');
    t.steps.forEach(function (st, i) {
      var esc = function (x) { return String(x).replace(/\|/g, '\\|'); };
      lines.push('| ' + (i + 1) + ' | ' + st.phase + ' | ' + esc(st.caption) + ' | ' +
        esc(st.stack.slice().reverse().join(' → ') || '—') + ' | ' +
        esc(st.micro.join(', ') || '—') + ' | ' +
        esc(st.macro.join(', ') || '—') + ' | ' +
        esc(st.console.join(' / ') || '—') + ' |');
    });
    lines.push('');
    lines.push('**Final console order:** ' + t.order.join(' → '));
    lines.push('');
    lines.push('> Verified against a real Node run (' + s.verifiedNode + ', ' + s.verifiedDate + '). Rule: ' +
      s.rule + ' — ' + s.cite.label + ' <' + s.cite.url + '>');
    lines.push('>');
    lines.push('> Generated by looptrace · https://sreenivas-sadhu-prabhakara.github.io/looptrace/#' + s.id);
    return lines.join('\n');
  }

  function initExports() {
    $('btnCopyMd').addEventListener('click', function () {
      var md = buildMarkdown();
      var status = $('copyStatus');
      var fallback = function () {
        var box = $('mdFallback');
        box.hidden = false;
        box.open = true;
        $('mdFallbackText').value = md;
        $('mdFallbackText').select();
        status.textContent = 'Clipboard unavailable — copy from the box below.';
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(md).then(function () {
          status.textContent = '✓ Copied as Markdown';
          setTimeout(function () { status.textContent = ''; }, 2500);
        }, fallback);
      } else {
        fallback();
      }
    });
    $('btnPrint').addEventListener('click', function () {
      buildPrintout();
      window.print();
    });
  }

  function buildPrintout() {
    var s = state.snippet;
    if (!s) return;
    var t = traceSnippet(s.id);
    var host = $('printout');
    host.textContent = '';

    var h = document.createElement('h2');
    h.textContent = 'looptrace — ' + s.title;
    host.appendChild(h);

    var pre = document.createElement('pre');
    pre.textContent = s.code;
    host.appendChild(pre);

    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['#', 'phase', 'what happens', 'console so far'].forEach(function (c) {
      var th = document.createElement('th');
      th.textContent = c;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    t.steps.forEach(function (st, i) {
      var tr = document.createElement('tr');
      [String(i + 1), st.phase, st.caption, st.console.join(' / ') || '—'].forEach(function (c) {
        var td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    host.appendChild(table);

    var foot = document.createElement('p');
    foot.className = 'printout__foot';
    foot.textContent = 'Final console order: ' + t.order.join(' → ') +
      ' · Verified against Node ' + s.verifiedNode + ' on ' + s.verifiedDate +
      ' · ' + s.cite.label + ' · looptrace (MIT) — educational model of the WHATWG event loop; not a debugger.';
    host.appendChild(foot);
  }

  /* ---------- boot ---------- */
  function fromHash() {
    var id = window.location.hash.replace(/^#/, '');
    var known = SNIPPETS.some(function (s) { return s.id === id; });
    return known ? id : SNIPPETS[0].id;
  }

  initTheme();
  buildFilters();
  initControls();
  initPredict();
  initExports();
  selectSnippet(fromHash(), false);
  window.addEventListener('hashchange', function () {
    var id = fromHash();
    if (!state.snippet || state.snippet.id !== id) selectSnippet(id, false);
  });
})();
