var params = new URLSearchParams(location.search);
var qlab = (params.get('lab') || '').trim();
var qpc = (params.get('pc') || '').trim();
var qid = (params.get('id') || '').trim().toUpperCase();

var busy = false;
var SEND_LABEL = 'Send report';
var SEND_LOADING = 'Dispatching report…';

function pcEl() { return $('#pc-selector'); }
function toastEl() { return $('#toast-message'); }
function sendBtn() { return $('#submit-report-btn'); }

function setSendLoading(on) {
  var b = sendBtn();
  if (!b) return;
  b.disabled = !!on;
  b.classList.toggle('is-loading', !!on);
  b.textContent = on ? SEND_LOADING : SEND_LABEL;
}

function checkedRecips() {
  return $$('#recips .recipient-checkbox:checked').map(function (el) {
    return el.dataset.a;
  });
}

function updateCount() {
  var c = $('#count');
  if (c) c.textContent = checkedRecips().length + ' selected';
}

function renderRecips() {
  var preOn = new Set(S.emails.filter(function (e) { return e.on; }).map(function (e) { return e.a; }));
  $('#recips').innerHTML = S.emails.length
    ? S.emails.map(function (e) {
      return '<label class="rec"><input type="checkbox" class="recipient-checkbox" data-a="' + esc(e.a) + '"' +
        (preOn.has(e.a) ? ' checked' : '') + '> <span>' + esc(e.a) + '</span></label>';
    }).join('')
    : '<p class="small">No recipients configured. Add emails under Catalog &amp; settings.</p>';
  updateCount();
}

function populateReportLabs() {
  var labs = loadLabs(), el = $('#reportLab');
  if (!el) return;
  el.innerHTML = labs.map(function (l) {
    return '<option value="' + esc(l.name) + '">' + esc(l.name) + '</option>';
  }).join('');
}

function populateReportPCs() {
  var labs = loadLabs(), labName = $('#reportLab').value;
  var lab = labs.filter(function (l) { return l.name === labName; })[0];
  var el = pcEl();
  if (!el) return;
  if (!lab) { el.innerHTML = ''; return; }
  el.innerHTML = getPCsForLab(lab).map(function (pc) {
    return '<option value="' + esc(pc) + '">' + esc(pc) + '</option>';
  }).join('');
  renderSpecs();
}

function renderSpecs() {
  var el = pcEl();
  if (!el) return;
  var id = el.value;
  var s = spec(id);
  $('#specs').innerHTML = FIELDS.map(function (f) {
    if (f[0] === 'pcSerial' || f[0] === 'monitorSerial') {
      return '<dt>' + f[1] + '</dt><dd>' + (s[f[0]] ? esc(s[f[0]]) : '\u2014') + '</dd>';
    }
    return '<dt>' + f[1] + '</dt><dd>' + esc(s[f[0]] || '\u2014') + '</dd>';
  }).join('');
}

function populateAdminLabs() {
  var labs = loadLabs(), el = $('#alab');
  if (!el) return;
  el.innerHTML = labs.map(function (l) {
    return '<option value="' + esc(l.name) + '">' + esc(l.name) + '</option>';
  }).join('');
  populateAdminPCs();
}

function populateAdminPCs() {
  var labs = loadLabs(), labName = $('#alab').value;
  var lab = labs.filter(function (l) { return l.name === labName; })[0];
  var el = $('#apc');
  if (!el) return;
  if (!lab) { el.innerHTML = ''; return; }
  el.innerHTML = getPCsForLab(lab).map(function (pc) {
    return '<option value="' + esc(pc) + '">' + esc(pc) + '</option>';
  }).join('');
  if (typeof renderAdminSpec === 'function') renderAdminSpec();
}

function resetSel() {}

function buildReport(p) {
  var s = p.specs;
  return '# Lab PC Damage Report\n\n' +
    '**Lab:** ' + p.lab + '\n**PC:** ' + p.pc_id + '\n**PC Serial:** ' + (p.pcSerial || 'Not given') + '\n**Monitor Serial:** ' + (p.monitorSerial || 'Not given') + '\n' +
    '**Category:** ' + p.category + '\n**Reported:** ' + p.timestamp + '\n**Reporter:** ' + (p.reporter || 'Not given') + '\n\n' +
    '## Hardware\n' + FIELDS.map(function (f) { return '- ' + f[1] + ': ' + (s[f[0]] || '—'); }).join('\n') + '\n\n' +
    '## Remarks\n' + p.remarks + '\n';
}

function unlock() {
  busy = false;
  setSendLoading(false);
}

function resetForm() {
  var r = $('#remarks-input'), rep = $('#reporter-name');
  if (r) r.value = '';
  if (rep) rep.value = '';
  $$('input[name=cat]').forEach(function (radio) { radio.checked = false; });
}

function buildFormspreeBody(p) {
  return {
    _subject: p.subject,
    _replyto: p.recipients[0],
    email: p.recipients[0],
    message: p.message,
    lab: p.lab,
    pc_id: p.pc_id,
    pcSerial: p.pcSerial || 'Not given',
    monitorSerial: p.monitorSerial || 'Not given',
    category: p.category,
    reporter: p.reporter || 'Not given',
    timestamp: p.timestamp,
    recipients: p.recipients.join(', ')
  };
}

/** POST /api/send-report only exists on serverless hosts (e.g. Vercel). Static hosts return 405. */
function shouldUseApiProxy() {
  if (location.protocol === 'file:' || !location.origin || location.origin === 'null') return false;
  var h = location.hostname;
  return /\.vercel\.app$/i.test(h) || h.endsWith('.vercel.sh') ||
    h === 'localhost' || h === '127.0.0.1';
}

function isProxyUnavailableStatus(status) {
  return status === 404 || status === 405 || status === 501;
}

function webhookLooksLikeThisSite(hookUrl) {
  try {
    var target = new URL(hookUrl);
    if (location.protocol === 'file:') return false;
    return target.origin === location.origin;
  } catch (e) {
    return false;
  }
}

function directWebhookFetch(hookUrl, hookType, p) {
  if (webhookLooksLikeThisSite(hookUrl)) {
    return Promise.reject(new Error(
      'The webhook URL points at this site, which cannot accept POST. Use Formspree or Google Apps Script, or switch to mailto mode.'
    ));
  }

  if (hookType === 'apps') {
    var appsBody = JSON.stringify(p);
    var appsHeaders = { 'Content-Type': 'text/plain;charset=utf-8', Accept: 'application/json' };
    return fetch(hookUrl, { method: 'POST', headers: appsHeaders, body: appsBody }).then(function (r) {
      if (r.type === 'opaque') return;
      if (!r.ok) throw new Error('HTTP ' + r.status + (r.statusText ? ' ' + r.statusText : ''));
    }).catch(function (err) {
      if (err && err.message && err.message.indexOf('HTTP') === 0) throw err;
      return fetch(hookUrl, { method: 'POST', mode: 'no-cors', headers: appsHeaders, body: appsBody });
    });
  }

  var body = JSON.stringify(buildFormspreeBody(p));
  var headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  return fetch(hookUrl, { method: 'POST', headers: headers, body: body }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + (r.statusText ? ' ' + r.statusText : ''));
  });
}

function sendViaApiProxy(hookUrl, hookType, p) {
  if (!shouldUseApiProxy()) {
    return Promise.reject(new Error('API_SKIP'));
  }
  return fetch('/api/send-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ webhookUrl: hookUrl, hookType: hookType, report: p })
  }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (data) {
      if (isProxyUnavailableStatus(r.status)) throw new Error('API_SKIP');
      if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
      if (data.ok === false) throw new Error(data.error || 'Send failed.');
    });
  });
}

function isProxySkipError(err) {
  return !!(err && err.message === 'API_SKIP');
}

function dispatchWebhook(hookUrl, hookType, p) {
  return sendViaApiProxy(hookUrl, hookType, p).catch(function (err) {
    if (isProxySkipError(err)) return directWebhookFetch(hookUrl, hookType, p);
    throw err;
  });
}

function completeWithMailto(p, m, note) {
  openMailto(p.recipients, p);
  show(m, 'ok', note || 'Your mail app should open. Press Send there to deliver the report.');
  resetForm();
  setTimeout(unlock, 3000);
}

function openMailto(to, p) {
  var url = 'mailto:' + encodeURIComponent(to[0]).replace(/%40/g, '@') + '?' +
    (to.length > 1
      ? 'cc=' + to.slice(1).map(function (a) {
        return encodeURIComponent(a).replace(/%40/g, '@');
      }).join(',') + '&'
      : '') +
    'subject=' + encodeURIComponent(p.subject) + '&body=' + encodeURIComponent(p.message);
  var a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function validateReport(m) {
  var labName = ($('#reportLab') && $('#reportLab').value) || '';
  var pcId = (pcEl() && pcEl().value) || '';
  if (!labName) { show(m, 'err', 'Select a lab.'); return null; }
  if (!pcId) { show(m, 'err', 'Select a PC.'); return null; }
  var cat = $('input[name=cat]:checked');
  var remarks = ($('#remarks-input') && $('#remarks-input').value.trim()) || '';
  var to = checkedRecips();
  if (!cat) { show(m, 'err', 'Choose a damage category.'); return null; }
  if (remarks.length < 5) { show(m, 'err', 'Describe the problem in the remarks box (at least 5 characters).'); return null; }
  if (!to.length) { show(m, 'err', 'Select at least one recipient email.'); return null; }
  var now = new Date();
  var s = spec(pcId);
  var p = {
    lab: labName,
    pc_id: pcId,
    pcSerial: s.pcSerial || 'Not given',
    monitorSerial: s.monitorSerial || 'Not given',
    category: cat.value,
    reporter: ($('#reporter-name') && $('#reporter-name').value.trim()) || '',
    remarks: remarks,
    specs: s,
    timestamp: now.toLocaleString() + ' (' + Intl.DateTimeFormat().resolvedOptions().timeZone + ')',
    recipients: to
  };
  p.subject = '[Lab PC Damage] ' + labName + ' / ' + pcId + ' - ' + p.category;
  p.message = buildReport(p);
  return p;
}

function handleSendReport() {
  if (busy) return;
  var m = toastEl();
  var form = $('#form');
  if (!m || !sendBtn()) {
    console.error('Report form controls missing from the page.');
    return;
  }
  if ($('#website') && $('#website').value) {
    busy = true;
    setSendLoading(true);
    show(m, 'ok', 'Report sent.');
    return;
  }
  var p = validateReport(m);
  if (!p) return;

  busy = true;
  setSendLoading(true);
  hide(m);

  if (S.mode === 'webhook') {
    var hookUrl = (S.hook && S.hook.url) || '';
    var hookType = (S.hook && S.hook.type) || 'apps';
    if (!hookUrl) {
      show(m, 'err', 'Webhook URL is missing. Open Catalog & settings, choose “Send silently (webhook)”, and save a URL.');
      unlock();
      return;
    }
    dispatchWebhook(hookUrl, hookType, p)
      .then(function () {
        show(m, 'ok', 'Report sent to ' + p.recipients.length + ' recipient' + (p.recipients.length > 1 ? 's' : '') + '.');
        resetForm();
        setTimeout(unlock, 4000);
      })
      .catch(function (err) {
        var detail = err && err.message ? err.message : 'Check your connection and webhook URL, then try again.';
        var useMailtoFallback = /HTTP 405|HTTP 404|Failed to fetch|NetworkError|webhook URL points/i.test(detail);
        if (useMailtoFallback) {
          completeWithMailto(
            p,
            m,
            'Server send failed (' + detail.replace(/^HTTP /, '') + '). Your mail app was opened instead—press Send to finish.'
          );
          return;
        }
        show(m, 'err', 'Could not send the report. ' + detail);
        unlock();
      });
    return;
  }

  try {
    openMailto(p.recipients, p);
    show(m, 'ok', 'Your mail app should open. Press Send there to finish.');
    resetForm();
    setTimeout(unlock, 3000);
  } catch (err) {
    show(m, 'err', 'Could not open your mail app. Switch to webhook mode under Catalog & settings.');
    unlock();
  }
}

function bindReportForm() {
  var form = $('#form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    handleSendReport();
  });

  var btn = sendBtn();
  if (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      handleSendReport();
    });
  }
}

function initReportTab() {
  populateReportLabs();
  var labSel = $('#reportLab');
  if (labSel) labSel.addEventListener('change', function () { populateReportPCs(); renderSpecs(); });
  populateReportPCs();

  if (qlab || qpc) {
    var labs = loadLabs();
    if (qlab) {
      var matchLab = labs.filter(function (l) { return l.name === qlab; })[0];
      if (matchLab) {
        if (labSel) labSel.value = qlab;
        populateReportPCs();
        if (qpc && pcEl()) pcEl().value = qpc;
      } else {
        show($('#idwarn'), 'err', 'Lab "' + qlab + '" is not configured. Pick the correct Lab below.');
      }
    }
    renderSpecs();
    var f = $('#form');
    if (f) f.scrollIntoView({ behavior: 'smooth' });
  } else if (qid) {
    show($('#idwarn'), 'err', 'Use the new QR stickers. Old ID: ' + qid);
  }

  populateAdminLabs();
  var alab = $('#alab');
  if (alab) alab.addEventListener('change', populateAdminPCs);

  var pcSelect = pcEl();
  if (pcSelect) pcSelect.addEventListener('change', renderSpecs);

  var cats = $('#cats');
  if (cats) {
    cats.innerHTML = CATS.map(function (c) {
      return '<label class="chip"><input type="radio" name="cat" value="' + esc(c) + '"><span>' + esc(c) + '</span></label>';
    }).join('');
  }

  var recips = $('#recips');
  if (recips) recips.addEventListener('change', updateCount);

  renderRecips();
  bindReportForm();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReportTab);
} else {
  initReportTab();
}
