/**
 * Lab PC Damage Reporter — Web App POST handler
 *
 * Deploy: Extensions → Apps Script → paste this file → Deploy → New deployment → Web app
 *         Execute as: Me | Who has access: Anyone
 * Then paste the new /exec URL into Catalog & settings → Webhook URL.
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
      htmlBody: htmlBody,
      name: 'Lab PC Damage Reporter'
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
    if (source.indexOf('[object Object]') >= 0) {
      source = {};
    } else {
      try {
        source = JSON.parse(source);
      } catch (parseErr) {
        source = {};
      }
    }
  }
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    source = {};
  }

  var specs = {};
  SPEC_KEYS.forEach(function (key) {
    var fromNested = source[key];
    var fromTop = data[key];
    var val = fromNested != null && String(fromNested).trim() !== '' ? fromNested : fromTop;
    specs[key] = formatSpecValue_(val);
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
  if (s === '[object Object]') return '—';
  return s === '' ? '—' : s;
}

function displayMeta_(val, fallback) {
  fallback = fallback || 'Not given';
  if (val == null) return fallback;
  if (typeof val === 'object') return fallback;
  var s = String(val).trim();
  if (s === '[object Object]') return fallback;
  return s === '' ? fallback : s;
}

function buildSubject_(data) {
  var pc = displayMeta_(data.pc_id, 'Unknown PC');
  var cat = displayMeta_(data.category, 'Damage');
  return '[URGENT DAMAGE REPORT] ' + pc + ' - ' + cat;
}

function hardwareBlockText_(data, specs) {
  if (data.hardwareSheet && typeof data.hardwareSheet === 'string') {
    var sheet = data.hardwareSheet.trim();
    if (sheet && sheet.indexOf('[object Object]') < 0) {
      return sheet;
    }
  }
  return SPEC_KEYS.map(function (key) {
    return (SPEC_LABELS[key] || key) + ' : ' + specs[key];
  }).join('\n');
}

function buildPlainBody_(data, specs) {
  var ws = displayMeta_(data.pc_id, '—');
  var hardwareBlock = hardwareBlockText_(data, specs);
  return [
    'Lab PC Damage Reporter',
    '=======================================',
    'Workstation ID : ' + ws,
    'Category       : ' + displayMeta_(data.category, '—'),
    'Reported By    : ' + displayMeta_(data.reporter, 'Not given'),
    'Submitted At   : ' + displayMeta_(data.timestamp, '—'),
    '=======================================',
    '',
    'HARDWARE SPECIFICATIONS:',
    '-------------------------',
    hardwareBlock,
    '',
    'DAMAGE REMARKS & NOTES:',
    '-------------------------',
    displayMeta_(data.remarks, '—'),
    '',
    '=======================================',
    'Sent via Lab PC Damage Reporter (HTML version available in supported clients).'
  ].join('\n');
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
      '<td style="padding:8px 0;font-family:Inter,Segoe UI,Roboto,sans-serif;font-size:13px;color:#3A5558;width:44%;vertical-align:top;border-bottom:1px solid #E0EEF2;">' +
      escapeHtml_(SPEC_LABELS[key]) + '</td>' +
      '<td style="padding:8px 0;font-family:Inter,Segoe UI,Roboto,sans-serif;font-size:13px;font-weight:600;color:#0D2B2F;vertical-align:top;border-bottom:1px solid #E0EEF2;">' +
      escapeHtml_(specs[key]) + '</td>' +
      '</tr>'
    );
  }).join('');

  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"></head>' +
    '<body style="margin:0;padding:0;background:#EBF6F8;-webkit-text-size-adjust:100%;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EBF6F8;border-collapse:collapse;">' +
    '<tr><td align="center" style="padding:20px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:separate;border-spacing:0;background:#FFFFFF;border:1px solid rgba(0,104,116,0.15);border-radius:16px;overflow:hidden;box-shadow:0 4px 28px rgba(0,104,116,0.14),0 1px 4px rgba(0,0,0,0.05);">' +

    '<tr><td style="background:#006874;color:#FFFFFF;padding:18px 22px;">' +
    '<div style="font-family:\'Plus Jakarta Sans\',Segoe UI,Roboto,sans-serif;font-size:19px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;">Lab PC Damage Reporter</div>' +
    '<div style="font-family:Inter,Segoe UI,Roboto,sans-serif;font-size:13px;margin-top:8px;line-height:1.4;opacity:0.95;">Workstation ID: ' +
    escapeHtml_(pcId) + (lab !== '—' && pcId.indexOf(lab) < 0 ? ' · ' + lab : '') + '</div>' +
    '</td></tr>' +

    '<tr><td style="padding:18px 22px 10px;background:#FFFFFF;">' +
    '<span style="display:inline-block;background:#FFDAD6;color:#93000A;padding:5px 12px;border-radius:9999px;font-family:Inter,Segoe UI,Roboto,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.02em;">' +
    category + '</span></td></tr>' +

    '<tr><td style="padding:4px 22px 16px;background:#FFFFFF;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#F2FBFF;border-radius:12px;border:1px solid #D0E6EF;">' +
    '<tr><td style="padding:12px 14px;width:50%;vertical-align:top;">' +
    '<div style="font-family:Inter,Segoe UI,Roboto,sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#3A5558;">Reporter</div>' +
    '<div style="font-family:Inter,Segoe UI,Roboto,sans-serif;font-size:14px;font-weight:600;color:#0D2B2F;margin-top:4px;">' + reporter + '</div></td>' +
    '<td style="padding:12px 14px;width:50%;vertical-align:top;">' +
    '<div style="font-family:Inter,Segoe UI,Roboto,sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#3A5558;">Submitted</div>' +
    '<div style="font-family:Inter,Segoe UI,Roboto,sans-serif;font-size:14px;font-weight:600;color:#0D2B2F;margin-top:4px;">' + timestamp + '</div></td></tr></table></td></tr>' +

    '<tr><td style="padding:0 22px 16px;background:#FFFFFF;">' +
    '<div style="background:#F2FBFF;border-radius:12px;border:1px solid #D0E6EF;padding:14px 16px;">' +
    '<div style="font-family:\'Plus Jakarta Sans\',Segoe UI,Roboto,sans-serif;font-size:14px;font-weight:700;color:#004E58;margin:0 0 12px;">Hardware specifications</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">' +
    specRows +
    '</table></div></td></tr>' +

    '<tr><td style="padding:0 22px 22px;background:#FFFFFF;">' +
    '<div style="font-family:\'Plus Jakarta Sans\',Segoe UI,Roboto,sans-serif;font-size:14px;font-weight:700;color:#004E58;margin:0 0 8px;">Damage remarks &amp; notes</div>' +
    '<div style="background:#FFFFFF;border:1px solid #C4D8DB;border-radius:12px;padding:14px 16px;font-family:Inter,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.55;color:#0D2B2F;">' +
    remarks + '</div></td></tr>' +

    '<tr><td style="padding:12px 22px 18px;background:#EBF6F8;border-top:1px solid #D0E6EF;text-align:center;">' +
    '<span style="font-family:Inter,Segoe UI,Roboto,sans-serif;font-size:11px;color:#3A5558;">Lab PC Damage Reporter · Web app dispatch</span></td></tr>' +

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
