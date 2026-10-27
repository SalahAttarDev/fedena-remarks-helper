// Fedena Marks Helper — runs on Gradebook > Mark Entry (/assessments/attribute_scores).
// 1) "Copy template": exports the students and mark columns (HW, Oral, Cw, Attnd...) as JSON.
// 2) "Paste & Fill": takes a marks JSON and fills each student's boxes. It never clicks Submit Marks.
(function () {
  if (document.getElementById('frh-panel')) return;

  function norm(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function fire(el) {
    ['input', 'change', 'keyup', 'blur'].forEach(function (e) { el.dispatchEvent(new Event(e, { bubbles: true })); });
  }

  // ---------- reading the page ----------
  function markInputs() {
    return Array.prototype.slice.call(document.querySelectorAll('input[name*="[marks]"][student_id][assess_id]'));
  }

  // Mark columns in page order. Names come from the header row (HW, Oral, Cw, Attnd...).
  function columns() {
    var ids = [];
    markInputs().forEach(function (i) { var a = i.getAttribute('assess_id'); if (ids.indexOf(a) === -1) ids.push(a); });
    var skip = /^(absent|grade|final score|no\.?|student|admission no\.?|\d+(\.\d+)?)$/i;
    var names = [];
    Array.prototype.forEach.call(document.querySelectorAll('table tr'), function (tr) {
      if (names.length) return;
      var cells = Array.from(tr.children).map(text).filter(function (t) { return t && !skip.test(t); });
      if (cells.length >= ids.length && ids.length) names = cells.slice(0, ids.length);
    });
    return ids.map(function (id, n) {
      var first = document.querySelector('input[assess_id="' + id + '"][max_marks]');
      return { id: id, name: names[n] || ('Column ' + (n + 1)), max: first ? parseFloat(first.getAttribute('max_marks')) : null };
    });
  }

  function students() {
    // Plain loop: Fedena's Prototype.js replaces Array#reduce/#map on the page.
    var seen = {}, list = [], inputs = markInputs();
    for (var k = 0; k < inputs.length; k++) {
      var sid = inputs[k].getAttribute('student_id');
      if (seen[sid]) continue;
      seen[sid] = true;
      var nameCell = document.getElementById('st_' + sid);
      var row = nameCell && nameCell.closest('tr');
      list.push({
        sid: sid,
        name: text(nameCell),
        admission_no: text(row && row.querySelector('.adn_number')),
      });
    }
    return list;
  }

  function context() {
    var info = {};
    var labels = ['Exam Group', 'Grade', 'Batch', 'Subject Exam', 'Maximum Marks'];
    Array.prototype.forEach.call(document.querySelectorAll('div, td, span'), function (el) {
      var t = text(el);
      if (labels.indexOf(t) !== -1 && !info[t]) {
        var next = el.nextElementSibling;
        if (next) info[t] = text(next);
      }
    });
    return { exam: info['Exam Group'] || '', grade: info['Grade'] || '', batch: info['Batch'] || '', subject: info['Subject Exam'] || '' };
  }

  // ---------- export ----------
  function buildTemplate() {
    var ctx = context(), cols = columns();
    var max = {};
    cols.forEach(function (c) { max[c.name] = c.max; });
    return {
      subject: ctx.subject, grade: ctx.grade, batch: ctx.batch, exam: ctx.exam, max: max,
      students: students().map(function (s) {
        var marks = {};
        cols.forEach(function (c) { marks[c.name] = null; });
        return { name: s.name, admission_no: s.admission_no, marks: marks };
      })
    };
  }

  // ---------- import ----------
  function extractJson(t) {
    t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('No JSON object found in the pasted text.');
    return JSON.parse(t.slice(a, b + 1));
  }

  function fill(data) {
    if (!data || !Array.isArray(data.students)) throw new Error('The JSON must contain a "students" list.');
    var ctx = context();
    if (data.batch && ctx.batch && norm(data.batch) !== norm(ctx.batch) &&
        !confirm('This JSON is for "' + data.batch + '" but the page shows "' + ctx.batch + '".\nFill anyway?')) return null;

    var cols = columns(), rows = students();
    var byCol = {};
    cols.forEach(function (c) { byCol[norm(c.name)] = c; });
    var res = { filled: 0, students: 0, total: rows.length, notOnPage: [], unknownCols: [], tooHigh: [], locked: 0 };

    data.students.forEach(function (s) {
      var key = norm(s.admission_no), nk = norm(s.name);
      var row = rows.find(function (r) { return key && norm(r.admission_no) === key; }) ||
                rows.find(function (r) { return nk && norm(r.name) === nk; });
      if (!row) { res.notOnPage.push(s.name || s.admission_no); return; }
      row.done = true;
      res.students++;
      Object.keys(s.marks || {}).forEach(function (colName) {
        var col = byCol[norm(colName)];
        if (!col) { if (res.unknownCols.indexOf(colName) === -1) res.unknownCols.push(colName); return; }
        var v = s.marks[colName];
        if (v === null || v === '' || v === undefined) return;
        var box = document.querySelector('input[student_id="' + row.sid + '"][assess_id="' + col.id + '"][name*="[marks]"]');
        if (!box) return;
        if (box.disabled) { res.locked++; return; }
        var num = parseFloat(v);
        if (isNaN(num) || num < 0 || (col.max !== null && num > col.max)) {
          res.tooHigh.push((row.name || row.admission_no) + ' ' + col.name + '=' + v);
          box.style.outline = '3px solid #d33';
          return;
        }
        box.value = String(num);
        fire(box);
        box.style.outline = '2px solid #2e9e44';
        res.filled++;
      });
    });
    rows.filter(function (r) { return !r.done; }).forEach(function (r) {
      Array.prototype.forEach.call(document.querySelectorAll('input[student_id="' + r.sid + '"][name*="[marks]"]'), function (b) {
        b.style.outline = '3px solid #d33';
      });
    });
    res.missing = rows.filter(function (r) { return !r.done; }).map(function (r) { return r.name; });
    return res;
  }

  // ---------- UI (reuses the remarks panel styles) ----------
  var panel = document.createElement('div');
  panel.id = 'frh-panel';
  panel.innerHTML =
    '<div class="frh-head"><span>🧮 Marks Helper</span><span class="frh-toggle">–</span></div>' +
    '<div class="frh-body">' +
    '<button class="frh-copy">📋 Copy marks template</button>' +
    '<button class="frh-sec frh-paste">📥 Paste &amp; Fill Marks</button>' +
    '<div class="frh-status"></div></div>';
  document.body.appendChild(panel);

  var status = panel.querySelector('.frh-status');
  var copyBtn = panel.querySelector('.frh-copy');
  var pasteBtn = panel.querySelector('.frh-paste');
  panel.querySelector('.frh-head').addEventListener('click', function () {
    panel.classList.toggle('frh-min');
    panel.querySelector('.frh-toggle').textContent = panel.classList.contains('frh-min') ? '+' : '–';
  });

  function summary() {
    var n = students().length, cols = columns(), locked = markInputs().some(function (i) { return i.disabled; });
    if (!n) return 'No mark boxes found on this page.';
    return n + ' students · ' + cols.map(function (c) { return c.name + ' /' + c.max; }).join(', ') +
      (locked ? '\n🔒 These marks are locked (already submitted) — nothing can be filled.' : '');
  }
  status.textContent = summary();
  copyBtn.disabled = pasteBtn.disabled = !students().length;

  function modal(title, hint, value, okLabel, onOk) {
    var m = document.createElement('div');
    m.id = 'frh-modal';
    m.innerHTML = '<div class="frh-box"><b></b><p style="margin:6px 0 8px;color:#555"></p><textarea></textarea>' +
      '<div class="frh-row"><button class="frh-cancel">Close</button><button class="frh-ok"></button></div></div>';
    m.querySelector('b').textContent = title;
    m.querySelector('p').textContent = hint;
    var ta = m.querySelector('textarea');
    ta.value = value || '';
    m.querySelector('.frh-ok').textContent = okLabel;
    m.querySelector('.frh-cancel').onclick = function () { m.remove(); };
    m.querySelector('.frh-ok').onclick = function () { if (onOk(ta) !== false) m.remove(); };
    document.body.appendChild(m);
    ta.focus();
  }

  copyBtn.addEventListener('click', function () {
    var json = JSON.stringify(buildTemplate(), null, 2);
    var done = function () { status.textContent = 'Template copied. Fill in the marks (or export them from gmis-platform), then use "Paste & Fill Marks".'; };
    var show = function () {
      modal('Marks template', 'Automatic copy was blocked — click "Select all" (it also copies).', json, 'Select all',
        function (ta) { ta.select(); document.execCommand('copy'); done(); return false; });
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(done, show);
    else show();
  });

  pasteBtn.addEventListener('click', function () {
    modal('Paste the marks JSON', 'Students are matched by admission number. Marks above the maximum are refused.', '', 'Fill marks', function (ta) {
      var r;
      try { r = fill(extractJson(ta.value)); } catch (e) { alert('Could not read the JSON:\n' + e.message); return false; }
      if (!r) return false;
      var msg = 'Filled ' + r.filled + ' marks for ' + r.students + ' of ' + r.total + ' students.';
      if (r.locked) msg += '\n🔒 ' + r.locked + ' boxes are locked and were skipped.';
      if (r.tooHigh.length) msg += '\nRefused (above max or not a number): ' + r.tooHigh.join(', ');
      if (r.unknownCols.length) msg += '\nColumns not on this page: ' + r.unknownCols.join(', ');
      if (r.notOnPage.length) msg += '\nNot on this page: ' + r.notOnPage.join(', ');
      if (r.missing.length) msg += '\nNo marks in JSON (red): ' + r.missing.join(', ');
      msg += '\n\nNothing is saved yet — check, then click "Submit Marks".';
      status.textContent = msg;
    });
  });
})();
