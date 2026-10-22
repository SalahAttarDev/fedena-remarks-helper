// Fedena Remarks Helper — runs on Remarks > Add custom remarks.
// 1) "Copy for AI": exports the selected batch (students + context) with instructions for the AI.
// 2) "Paste & Fill": takes the AI's JSON and fills each student's remark. It never clicks Finish.
(function () {
  if (document.getElementById('frh-panel')) return;

  var STORE_KEY = 'frhSettings';
  var DEFAULTS = { subject: '', remarkedBy: '', topics: '' };

  // ---------- storage (chrome.storage when available, localStorage otherwise) ----------
  function loadSettings(cb) {
    try {
      if (window.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(STORE_KEY, function (r) { cb(Object.assign({}, DEFAULTS, r && r[STORE_KEY])); });
        return;
      }
    } catch (e) {}
    try { cb(Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORE_KEY) || '{}'))); } catch (e) { cb(Object.assign({}, DEFAULTS)); }
  }
  function saveSettings(s) {
    try { if (window.chrome && chrome.storage && chrome.storage.local) { var o = {}; o[STORE_KEY] = s; chrome.storage.local.set(o); return; } } catch (e) {}
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  // ---------- reading the page ----------
  function norm(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function boxes() { return Array.prototype.slice.call(document.querySelectorAll('textarea[name*="[remark][remark_body]"]')); }
  function selectedText(sel) { var o = sel && sel.options[sel.selectedIndex]; return o ? o.text.trim() : ''; }

  function context() {
    var grade = '', batch = '';
    Array.prototype.forEach.call(document.querySelectorAll('select'), function (s) {
      var t = selectedText(s);
      if (/^Select/i.test(t)) return;
      if (/\(\d{4}\s*-\s*\d{4}\)/.test(t)) batch = t; else if (/grade|class|year/i.test(t)) grade = t;
    });
    return { grade: grade, batch: batch };
  }

  // Each remark box sits in a .single-remark block with .st-name and .st-admssn-no (fallbacks for other layouts).
  function studentFor(box) {
    var single = box.closest('.single-remark');
    if (single && single.querySelector('.st-name')) {
      var adm = single.querySelector('.st-admssn-no');
      return {
        name: single.querySelector('.st-name').innerText.replace(/\s+/g, ' ').trim(),
        admission_no: adm ? adm.innerText.trim() : ''
      };
    }
    var row = box.closest('tr');
    if (row && row.cells.length >= 2) {
      return { name: row.cells[0].innerText.trim(), admission_no: row.cells[1].innerText.trim() };
    }
    var p = box.parentElement;
    for (var k = 0; k < 6 && p && !p.innerText.replace(box.value, '').trim(); k++) p = p.parentElement;
    var text = (p ? p.innerText : '').replace(box.value, '').replace(/\s+/g, ' ').trim();
    var m = text.match(/^(.*?)\s+([A-Z]{0,3}\d{2,})$/i);
    return m ? { name: m[1].trim(), admission_no: m[2] } : { name: text, admission_no: '' };
  }

  function students() {
    return boxes().map(function (b) {
      var s = studentFor(b);
      return { box: b, name: s.name, admission_no: s.admission_no, key: norm(s.admission_no), nameKey: norm(s.name) };
    });
  }

  // ---------- export ----------
  function buildExport(settings) {
    var ctx = context();
    var list = students().map(function (s) { return { name: s.name, admission_no: s.admission_no, notes: '', remark: '' }; });
    var json = {
      subject: settings.subject || 'SUBJECT',
      remarked_by: settings.remarkedBy || 'TEACHER NAME',
      grade: ctx.grade,
      batch: ctx.batch,
      students: list
    };
    var prompt = [
      'You are helping a teacher write end-of-term progress remarks for a school report (Fedena).',
      '',
      'Write one remark per student and return ONLY the JSON below with every "remark" filled in.',
      'Keep every other field exactly as it is (same students, same admission_no, same order). No text before or after the JSON.',
      '',
      'Each remark must use this format, with blank lines between sections:',
      'Topic: <topics covered>',
      '',
      'Subtopics: <subtopics / weeks>',
      '',
      'Assessment Objectives:',
      '1. <objective>',
      '2. <objective>',
      '',
      'Subject Feedback:',
      '<3 sentences: progress, what the student can do, one thing to keep practising>',
      '',
      'Overall Comments:',
      '<2 sentences: attitude/effort and encouragement>',
      '',
      'Rules:',
      '- Write like a real teacher giving a general view of the student: natural, warm, varied sentences.',
      '- Use the first name only once or twice per section; do not start every sentence with the name. Do not use he/she unless the notes give it.',
      '- Mention the topics lightly (e.g. "has become more familiar with Word"), not as a list.',
      '- Without notes, keep the tone neutral: the student participates and is making steady progress. Avoid "excellent"/"outstanding" and avoid criticism.',
      '- Use the "notes" field for each student when it is filled; otherwise keep the remark positive and general.',
      '- Do not invent marks, incidents or facts that are not in the notes or lesson plan.',
      '- Vary the wording so remarks for different students are not identical.',
      '- Only mention topics from the lesson plan below.',
      '',
      'LESSON PLAN / TOPICS TAUGHT:',
      settings.topics || '<paste your lesson plan here>',
      '',
      'CLASS JSON (fill in "notes" yourself if you like, before sending):',
      JSON.stringify(json, null, 2)
    ].join('\n');
    return { prompt: prompt, count: list.length, ctx: ctx };
  }

  // ---------- import ----------
  function extractJson(text) {
    text = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    var start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON object found in the pasted text.');
    return JSON.parse(text.slice(start, end + 1));
  }

  function fire(el) { ['input', 'change'].forEach(function (e) { el.dispatchEvent(new Event(e, { bubbles: true })); }); }

  function fill(data) {
    if (!data || !Array.isArray(data.students)) throw new Error('The JSON must contain a "students" list.');
    var ctx = context();
    if (data.batch && ctx.batch && norm(data.batch) !== norm(ctx.batch) &&
        !confirm('This JSON is for "' + data.batch + '" but the page shows "' + ctx.batch + '".\nFill anyway?')) return null;

    var subj = document.getElementById('remark_remark_subject');
    var by = document.getElementById('remark_remarked_by');
    if (subj && data.subject) { subj.value = data.subject; fire(subj); }
    if (by && data.remarked_by) { by.value = data.remarked_by; fire(by); }

    var rows = students();
    rows.forEach(function (r) { r.used = false; r.box.style.outline = ''; });
    var filled = 0, notOnPage = [], blank = [];
    data.students.forEach(function (s) {
      var key = norm(s.admission_no), nk = norm(s.name), row = null;
      for (var i = 0; i < rows.length && !row; i++) if (!rows[i].used && key && rows[i].key === key) row = rows[i];
      for (var j = 0; j < rows.length && !row; j++) if (!rows[j].used && nk && rows[j].nameKey === nk) row = rows[j];
      if (!row) { notOnPage.push(s.name || s.admission_no); return; }
      row.used = true;
      if (!String(s.remark || '').trim()) { blank.push(row.name); return; }
      row.box.value = String(s.remark).trim();
      fire(row.box);
      row.box.style.outline = '2px solid #2e9e44';
      filled++;
    });
    var empty = rows.filter(function (r) { return !r.used || !r.box.value.trim(); });
    empty.forEach(function (r) { r.box.style.outline = '3px solid #d33'; });
    return { filled: filled, total: rows.length, notOnPage: notOnPage, blank: blank, empty: empty.length };
  }

  // ---------- UI ----------
  var panel = document.createElement('div');
  panel.id = 'frh-panel';
  panel.innerHTML =
    '<div class="frh-head"><span>📝 Remarks Helper</span><span class="frh-toggle">–</span></div>' +
    '<div class="frh-body">' +
    '<label>Subject</label><input data-k="subject" placeholder="e.g. FRENCH">' +
    '<label>Remark by</label><input data-k="remarkedBy" placeholder="e.g. Salah Attar">' +
    '<label>Lesson plan / topics (saved for next time)</label><textarea data-k="topics" placeholder="Paste what you taught this term"></textarea>' +
    '<button class="frh-copy">📋 Copy for AI</button>' +
    '<button class="frh-sec frh-paste">📥 Paste &amp; Fill</button>' +
    '<div class="frh-status"></div></div>';
  document.body.appendChild(panel);

  var status = panel.querySelector('.frh-status');
  var copyBtn = panel.querySelector('.frh-copy');
  var pasteBtn = panel.querySelector('.frh-paste');
  var inputs = panel.querySelectorAll('[data-k]');
  var settings = Object.assign({}, DEFAULTS);

  loadSettings(function (s) {
    settings = s;
    Array.prototype.forEach.call(inputs, function (el) { el.value = settings[el.getAttribute('data-k')] || ''; });
  });
  Array.prototype.forEach.call(inputs, function (el) {
    el.addEventListener('input', function () { settings[el.getAttribute('data-k')] = el.value; saveSettings(settings); });
  });
  panel.querySelector('.frh-head').addEventListener('click', function () {
    panel.classList.toggle('frh-min');
    panel.querySelector('.frh-toggle').textContent = panel.classList.contains('frh-min') ? '+' : '–';
  });

  var lastCount = -1;
  function refresh() {
    var n = boxes().length, ctx = context();
    if (n !== lastCount) { lastCount = n; delete status.dataset.sticky; }
    copyBtn.disabled = pasteBtn.disabled = !n;
    if (status.dataset.sticky) return;
    var text = n ? (ctx.batch || 'Batch') + ': ' + n + ' students found.' : 'Choose a Grade and Batch to load the students.';
    if (status.textContent !== text) status.textContent = text;
  }
  function say(msg) { status.dataset.sticky = '1'; status.textContent = msg; }

  // Watch for Fedena loading a new batch. Ignore changes made by our own panel/modal,
  // otherwise updating the status text would trigger the observer again in an endless loop.
  var timer = null;
  new MutationObserver(function (mutations) {
    var external = mutations.some(function (m) {
      var t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      return !(t && t.closest && t.closest('#frh-panel, #frh-modal'));
    });
    if (!external) return;
    clearTimeout(timer);
    timer = setTimeout(refresh, 300);
  }).observe(document.body, { childList: true, subtree: true });
  refresh();

  function modal(title, value, okLabel, onOk) {
    var m = document.createElement('div');
    m.id = 'frh-modal';
    m.innerHTML = '<div class="frh-box"><b></b><p class="frh-hint" style="margin:6px 0 8px;color:#555"></p><textarea></textarea>' +
      '<div class="frh-row"><button class="frh-cancel">Close</button><button class="frh-ok"></button></div></div>';
    m.querySelector('b').textContent = title;
    var ta = m.querySelector('textarea');
    ta.value = value || '';
    m.querySelector('.frh-ok').textContent = okLabel;
    m.querySelector('.frh-cancel').onclick = function () { m.remove(); };
    m.querySelector('.frh-ok').onclick = function () { if (onOk(ta, m) !== false) m.remove(); };
    document.body.appendChild(m);
    ta.focus();
    return m;
  }

  copyBtn.addEventListener('click', function () {
    var ex = buildExport(settings);
    var done = function () { say('Copied ' + ex.count + ' students (' + (ex.ctx.batch || 'this batch') + ').\nPaste it into your AI, then use "Paste & Fill".'); };
    var show = function () {
      var m = modal('Copy this and send it to your AI', ex.prompt, 'Select all', function (ta) { ta.select(); document.execCommand('copy'); done(); return false; });
      m.querySelector('.frh-hint').textContent = 'Automatic copy was blocked — click "Select all" (it also copies), or press Ctrl+A then Ctrl+C.';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ex.prompt).then(done, show);
    else show();
  });

  pasteBtn.addEventListener('click', function () {
    var m = modal('Paste the JSON your AI returned', '', 'Fill remarks', function (ta) {
      var res;
      try { res = fill(extractJson(ta.value)); } catch (e) { alert('Could not read the JSON:\n' + e.message); return false; }
      if (!res) return false;
      var msg = 'Filled ' + res.filled + ' of ' + res.total + ' students.';
      if (res.notOnPage.length) msg += '\nNot on this page: ' + res.notOnPage.join(', ');
      if (res.blank.length) msg += '\nEmpty remark in JSON: ' + res.blank.join(', ');
      if (res.empty) msg += '\nRed boxes still empty: ' + res.empty;
      msg += '\n\nNothing is saved yet — check, then click "Finish".';
      say(msg);
      var fin = document.getElementById('batch_submit');
      if (fin) fin.scrollIntoView({ block: 'center' });
    });
    m.querySelector('.frh-hint').textContent = 'Paste the whole answer — extra text or ``` fences around the JSON are fine.';
  });
})();
