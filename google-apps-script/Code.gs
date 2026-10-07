/**
 * Lab PC Damage Reporter — Web App POST handler
 * Deploy as Web App: Execute as Me, Anyone with the link.
 */

var SPEC_KEYS = ['model', 'cpu', 'ram', 'storage', 'gpu', 'os', 'pcSerial', 'monitorSerial'];
var SPEC_LABELS = {
  model: 'Model',
  cpu: 'CPU',
  ram: 'RAM',
  storage: 'Storage',
  gpu: 'GPU',
  os: 'Operating System',
  pcSerial: 'PC Serial Number',
  monitorSerial: 'Monitor Serial Number'
};

function doPost(e) {
  try {
    var data = parsePostData_(e);
    var recipients = normalizeRecipients_(data);
    if (!recipients.length) {
      return jsonResponse_({ ok: false, error: 'No recipients in payload.' });
    }

    var specs = normalizeSpecs_(data);
    var subject = data.subject || buildSubject_(data);
    var plainBody = buildPlainBody_(data, specs);
    var htmlBody = buildHtmlEmail_(data, specs);

    MailApp.sendEmail({
      to: recipients.join(','),
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody
    });

    return jsonResponse_({ ok: true });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

function parsePostData_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Empty POST body.');
  }
  var raw = e.postData.contents;
  var data = JSON.parse(raw);
  if (data && data.report && typeof data.report === 'object') {
    data = data.report;
  }
  return data;
}

function normalizeRecipients_(data) {
  var list = data.recipients;
  if (typeof list === 'string') {
    list = list.split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  if (!Array.isArray(list)) return [];
  return list.filter(function (a) { return a && String(a).indexOf('@') > 0; });
}

function normalizeSpecs_(data) {
  var source = data.specs;
  if (source == null && data.hardware != null) {
    source = data.hardware;
  }
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch (parseErr) {
      source = {};
    }
  }
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    source = {};
  }

  var specs = {};
  SPEC_KEYS.forEach(function (key) {
    specs[key] = formatSpecValue_(source[key]);
  });

  if (data.pcSerial != null && String(data.pcSerial).trim() !== '') {
    specs.pcSerial = formatSpecValue_(data.pcSerial);
  }
  if (data.monitorSerial != null && String(data.monitorSerial).trim() !== '') {
    specs.monitorSerial = formatSpecValue_(data.monitorSerial);
  }

  return specs;
}

function formatSpecValue_(val) {
  if (val == null) return '—';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch (e) {
      return '—';
    }
  }
  var s = String(val).trim();
  return s === '' ? '—' : s;
}

function displayMeta_(val, fallback) {
  fallback = fallback || 'Not given';
  if (val == null) return fallback;
  if (typeof val === 'object') return fallback;
  var s = String(val).trim();
  return s === '' ? fallback : s;
}

function buildSubject_(data) {
  var lab = displayMeta_(data.lab, 'Unknown lab');
  var pc = displayMeta_(data.pc_id, 'Unknown PC');
  var cat = displayMeta_(data.category, 'Damage');
  return '[Lab PC Damage] ' + lab + ' / ' + pc + ' - ' + cat;
}

function buildPlainBody_(data, specs) {
  var lines = [
    'Lab PC Damage Report',
    '',
    'Lab: ' + displayMeta_(data.lab, '—'),
    'PC: ' + displayMeta_(data.pc_id, '—'),
    'Category: ' + displayMeta_(data.category, '—'),
    'Reported: ' + displayMeta_(data.timestamp, '—'),
    'Reporter: ' + displayMeta_(data.reporter, 'Not given'),
    '',
    'Hardware',
    '--------'
  ];
  SPEC_KEYS.forEach(function (key) {
    lines.push((SPEC_LABELS[key] || key) + ': ' + specs[key]);
  });
  lines.push('', 'Remarks', '-------', displayMeta_(data.remarks, '—'));
  return lines.join('\n');
}

function buildHtmlEmail_(data, specs) {
  var lab = escapeHtml_(displayMeta_(data.lab, '—'));
  var pcId = escapeHtml_(displayMeta_(data.pc_id, '—'));
  var category = escapeHtml_(displayMeta_(data.category, '—'));
  var timestamp = escapeHtml_(displayMeta_(data.timestamp, '—'));
  var reporter = escapeHtml_(displayMeta_(data.reporter, 'Not given'));
  var remarks = escapeHtml_(displayMeta_(data.remarks, '—')).replace(/\n/g, '<br>');

  var specRows = SPEC_KEYS.map(function (key) {
    return (
      '<tr>' +
      '<td style="padding:6px 0;font-family:Inter,Segoe UI,sans-serif;font-size:13px;color:#3A5558;width:42%;vertical-align:top;">' +
      escapeHtml_(SPEC_LABELS[key]) + '</td>' +
      '<td style="padding:6px 0;font-family:Inter,Segoe UI,sans-serif;font-size:13px;font-weight:600;color:#0D2B2F;vertical-align:top;">' +
      escapeHtml_(specs[key]) + '</td>' +
      '</tr>'
    );
  }).join('');

  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#EBF6F8;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EBF6F8;border-collapse:collapse;">' +
    '<tr><td align="center" style="padding:24px 16px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:collapse;background:#FFFFFF;border:1px solid rgba(0,104,116,0.15);border-radius:16px;overflow:hidden;box-shadow:0 4px 28px rgba(0,104,116,0.14),0 1px 4px rgba(0,0,0,0.05);">' +

    '<tr><td style="background:#006874;color:#FFFFFF;padding:16px 24px;border-radius:16px 16px 0 0;">' +
    '<div style="font-family:\'Plus Jakarta Sans\',Segoe UI,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.02em;">Lab PC Damage Reporter</div>' +
    '<div style="font-family:Inter,Segoe UI,sans-serif;font-size:13px;margin-top:6px;opacity:0.92;">Workstation ID: ' + lab + ' · ' + pcId + '</div>' +
    '</td></tr>' +

    '<tr><td style="padding:20px 24px 8px;">' +
    '<span style="display:inline-block;background:#FFDAD6;color:#93000A;padding:4px 10px;border-radius:9999px;font-family:Inter,Segoe UI,sans-serif;font-size:12px;font-weight:600;">' +
    category + '</span>' +
    '</td></tr>' +

    '<tr><td style="padding:8px 24px 16px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">' +
    '<tr>' +
    '<td style="width:50%;padding:8px 12px 8px 0;font-family:Inter,Segoe UI,sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#3A5558;">Reporter</td>' +
    '<td style="width:50%;padding:8px 0;font-family:Inter,Segoe UI,sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#3A5558;">Reported</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding:0 12px 0 0;font-family:Inter,Segoe UI,sans-serif;font-size:14px;font-weight:600;color:#0D2B2F;">' + reporter + '</td>' +
    '<td style="padding:0;font-family:Inter,Segoe UI,sans-serif;font-size:14px;font-weight:600;color:#0D2B2F;">' + timestamp + '</td>' +
    '</tr>' +
    '</table></td></tr>' +

    '<tr><td style="padding:0 24px 16px;">' +
    '<div style="background:#F2FBFF;border-radius:12px;border:1px solid #D0E6EF;padding:14px 16px;">' +
    '<div style="font-family:\'Plus Jakarta Sans\',Segoe UI,sans-serif;font-size:13px;font-weight:700;color:#004E58;margin-bottom:10px;">Hardware specs</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">' +
    specRows +
    '</table></div></td></tr>' +

    '<tr><td style="padding:0 24px 24px;">' +
    '<div style="font-family:\'Plus Jakarta Sans\',Segoe UI,sans-serif;font-size:13px;font-weight:700;color:#004E58;margin-bottom:8px;">Remarks</div>' +
    '<div style="background:#FFFFFF;border:1px solid #C4D8DB;border-radius:12px;padding:14px 16px;font-family:Inter,Segoe UI,sans-serif;font-size:14px;line-height:1.55;color:#0D2B2F;">' +
    remarks + '</div></td></tr>' +

    '</table></td></tr></table></body></html>'
  );
}

function escapeHtml_(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
