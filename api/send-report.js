/**
 * Vercel serverless proxy for damage reports.
 *
 * Environment variables (Vercel → Project → Settings → Environment Variables):
 *   WEBHOOK_URL   Apps Script /exec URL (or Formspree URL). Required. Never taken from the request.
 *   GAS_SECRET    Shared secret, must equal the SECRET Script Property in the Apps Script.
 *   HOOK_TYPE     "apps" (default) or "formspree".
 *
 * The browser calls this endpoint from the same origin, so no CORS headers are set.
 */

var CATEGORIES = ['Display', 'Peripheral', 'Power', 'Hardware', 'OS/Software', 'Network'];
var SPEC_KEYS = ['model', 'cpu', 'ram', 'storage', 'gpu', 'os', 'pcSerial', 'monitorSerial'];
var ID_RE = /^[A-Za-z0-9 ._\-]{1,60}$/;
var EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function str(v, max) {
  if (v == null) return '';
  if (typeof v === 'object') return '';
  return String(v).trim().slice(0, max);
}

/** Returns a clean report object, or null if the payload is not acceptable. */
function sanitizeReport(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  var lab = str(r.lab, 60), pc = str(r.pc_id, 60), cat = str(r.category, 40);
  var remarks = str(r.remarks, 1500);
  if (!ID_RE.test(lab) || !ID_RE.test(pc)) return null;
  if (CATEGORIES.indexOf(cat) < 0) return null;
  if (remarks.length < 5) return null;
  if (!Array.isArray(r.recipients)) return null;
  var recipients = r.recipients.map(function (a) { return str(a, 254); })
    .filter(function (a) { return EMAIL_RE.test(a); }).slice(0, 10);
  if (!recipients.length) return null;

  var src = (r.specs && typeof r.specs === 'object' && !Array.isArray(r.specs)) ? r.specs : {};
  var specs = {};
  SPEC_KEYS.forEach(function (k) { specs[k] = str(src[k], 100) || '—'; });

  return {
    lab: lab,
    pc_id: pc,
    category: cat,
    remarks: remarks,
    reporter: str(r.reporter, 80),
    timestamp: str(r.timestamp, 80),
    recipients: recipients,
    specs: specs,
    pcSerial: specs.pcSerial,
    monitorSerial: specs.monitorSerial
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  var hookUrl = process.env.WEBHOOK_URL || '';
  var secret = process.env.GAS_SECRET || '';
  var hookType = process.env.HOOK_TYPE === 'formspree' ? 'formspree' : 'apps';
  if (!hookUrl || (hookType === 'apps' && !secret)) {
    res.status(500).json({ ok: false, error: 'Server is not configured (WEBHOOK_URL / GAS_SECRET).' });
    return;
  }

  var body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  var report = sanitizeReport(body && body.report);
  if (!report) {
    res.status(400).json({ ok: false, error: 'Invalid report.' });
    return;
  }

  var payload, headers;
  if (hookType === 'apps') {
    report.secret = secret;
    payload = JSON.stringify(report);
    headers = { 'Content-Type': 'text/plain;charset=utf-8', Accept: 'application/json' };
  } else {
    payload = JSON.stringify({
      email: report.recipients[0],
      subject: '[URGENT DAMAGE REPORT] ' + report.pc_id + ' - ' + report.category,
      message: report.remarks,
      lab: report.lab,
      pc_id: report.pc_id,
      pcSerial: report.pcSerial,
      monitorSerial: report.monitorSerial,
      category: report.category,
      reporter: report.reporter || 'Not given',
      timestamp: report.timestamp,
      recipients: report.recipients.join(', ')
    });
    headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  }

  try {
    var upstream = await fetch(hookUrl, { method: 'POST', headers: headers, body: payload, redirect: 'follow' });
    var text = await upstream.text();
    if (!upstream.ok) {
      res.status(502).json({ ok: false, error: 'Webhook returned HTTP ' + upstream.status });
      return;
    }
    if (hookType === 'apps') {
      var data;
      try { data = JSON.parse(text); } catch (e) { data = null; }
      if (!data || data.ok !== true) {
        res.status(502).json({ ok: false, error: (data && data.error) || 'Unexpected response from Apps Script.' });
        return;
      }
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Could not reach webhook.' });
  }
};
