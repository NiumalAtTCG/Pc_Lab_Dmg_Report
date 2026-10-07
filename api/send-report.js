/** Vercel serverless proxy — avoids browser CORS limits on Google Apps Script / Formspree. */

function isAllowedWebhookUrl(url) {
  try {
    var u = new URL(url);
    if (u.protocol !== 'https:') return false;
    var h = u.hostname;
    if (h === 'script.google.com' || h === 'formspree.io') return true;
    if (h.endsWith('.formspree.io')) return true;
    return false;
  } catch (e) {
    return false;
  }
}

var SPEC_KEYS = ['model', 'cpu', 'ram', 'storage', 'gpu', 'os', 'pcSerial', 'monitorSerial'];

function coerceSpecString(val) {
  if (val == null) return '';
  if (typeof val === 'object') {
    try { return JSON.stringify(val); } catch (e) { return ''; }
  }
  return String(val).trim();
}

/** Ensure nested specs/hardware are plain strings before POSTing to Google Apps Script. */
function normalizeReportForApps(report) {
  var source = report.specs;
  if (source == null && report.hardware != null) source = report.hardware;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch (e) { source = {}; }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) source = {};

  var specs = {};
  SPEC_KEYS.forEach(function (key) {
    var v = coerceSpecString(source[key]);
    specs[key] = v === '' ? '—' : v;
  });

  report.specs = specs;
  report.hardware = specs;
  if (report.pcSerial != null && coerceSpecString(report.pcSerial) !== '') {
    report.pcSerial = coerceSpecString(report.pcSerial);
    if (specs.pcSerial === '—') specs.pcSerial = report.pcSerial;
  }
  if (report.monitorSerial != null && coerceSpecString(report.monitorSerial) !== '') {
    report.monitorSerial = coerceSpecString(report.monitorSerial);
    if (specs.monitorSerial === '—') specs.monitorSerial = report.monitorSerial;
  }
  return report;
}

function buildFormspreeBody(p) {
  return {
    email: p.recipients[0],
    subject: p.subject,
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  var body = req.body || {};
  var hookUrl = body.webhookUrl || process.env.WEBHOOK_URL || process.env.GAS_WEBHOOK_URL || '';
  var hookType = body.hookType || 'apps';
  var report = body.report;

  if (!hookUrl || !isAllowedWebhookUrl(hookUrl)) {
    res.status(400).json({ ok: false, error: 'Invalid or missing webhook URL.' });
    return;
  }
  if (!report || typeof report !== 'object') {
    res.status(400).json({ ok: false, error: 'Missing report payload.' });
    return;
  }

  var payload, headers;
  if (hookType === 'apps') {
    payload = JSON.stringify(normalizeReportForApps(Object.assign({}, report)));
    headers = { 'Content-Type': 'text/plain;charset=utf-8', Accept: 'application/json' };
  } else {
    payload = JSON.stringify(buildFormspreeBody(report));
    headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  }

  try {
    var upstream = await fetch(hookUrl, { method: 'POST', headers: headers, body: payload, redirect: 'follow' });
    var text = await upstream.text();
    if (!upstream.ok) {
      res.status(502).json({
        ok: false,
        error: 'Webhook returned HTTP ' + upstream.status + (text ? ': ' + text.slice(0, 200) : '')
      });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message || 'Could not reach webhook.' });
  }
};
