/* ============================================================
   YallahClick - Email notifications (Gmail SMTP via nodemailer)

   Env (set these on Vercel):
     YC_MAIL_USER   Gmail address that sends the emails
     YC_MAIL_PASS   Gmail APP PASSWORD (16 chars, NOT the login pw)
     YC_MAIL_TO     recipient for site-event notifications
     YC_MAIL_FROM   optional override <"Name" email>; defaults to YC_MAIL_USER
     YC_KV_REST_URL / YC_KV_REST_TOKEN  used for the daily digest accumulator
     YC_CRON_SECRET optional bearer token that guards the digest endpoint

   Behavior:
     - Bookings (and submissions in general) notify instantly.
     - Views/downloads are accumulated per item in KV and emailed once a
       day as a digest by /api/cron/digest (Vercel Cron Job).
     - If YC_MAIL_USER/PASS are not configured the module no-ops safely
       (never crashes an endpoint).
   ============================================================ */
'use strict';

const KV_URL = process.env.YC_KV_REST_URL || '';
const KV_TOKEN = process.env.YC_KV_REST_TOKEN || '';
const KV_ENABLED = !!(KV_URL && KV_TOKEN);
const DIGEST_KEY = 'yc:mailer:digest';
const USER = process.env.YC_MAIL_USER || '';
const PASS = process.env.YC_MAIL_PASS || '';
const TO = (process.env.YC_MAIL_TO || USER).trim();
const FROM = (process.env.YC_MAIL_FROM || USER).trim();

let transport = null;
function getTransport(){
  if (!USER || !PASS) return null;
  if (!transport){
    const nodemailer = require('nodemailer');
    transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: USER, pass: PASS }
    });
  }
  return transport;
}

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(subject, html){
  return '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#222">' +
    '<div style="background:linear-gradient(90deg,#f97316,#ef4444);padding:18px 22px;border-radius:12px 12px 0 0">' +
    '<h2 style="margin:0;color:#fff;font-size:18px">' + esc(subject) + '</h2></div>' +
    '<div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:20px 22px;background:#fff">' +
    html +
    '<p style="margin-top:22px;font-size:12px;color:#9ca3af">YallahClick · automated notification · yallah-click.vercel.app</p>' +
    '</div></div>';
}

async function sendMail({ subject, html }){
  const t = getTransport();
  if (!t) { console.log('[mailer] not configured - notification skipped'); return false; }
  if (!TO) return false;
  try{
    await t.sendMail({ from: FROM, to: TO, subject, html });
    console.log('[mailer] sent: ' + subject);
    return true;
  }catch(e){
    console.error('[mailer] send failed: ' + (e && e.message || e));
    return false;
  }
}

/* ---------- instant notification: one item ---------- */
async function notifyItem({ kind, title, rows }){
  const t = getTransport();
  if (!t) return false;
  const subject = 'YallahClick - ' + kind + (title ? ': ' + title : '');
  const html = layout(subject,
    '<p style="margin-top:0;font-size:15px">' + esc(kind) + (title ? ' <b>' + esc(title) + '</b>' : '') + ' just happened.</p>' +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' +
    rows.map(function(r){
      return '<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280;width:140px;background:#f9fafb">' + esc(r[0]) + '</td>' +
        '<td style="padding:6px 10px;border:1px solid #e5e7eb">' + esc(r[1]) + '</td></tr>';
    }).join('') + '</table>');
  return sendMail({ subject, html });
}

async function notifyBooking(b){
  if (!b) return false;
  return notifyItem({
    kind: 'New booking received',
    title: b.customerName,
    rows: [
      ['Customer', b.customerName],
      ['Email', b.email],
      ['Phone', b.phone],
      ['Service', b.serviceName || b.serviceId],
      ['Date', b.date],
      ['Message', (b.message || '').slice(0, 800)]
    ]
  });
}

/* ---------- daily digest accumulator (persisted in KV) ---------- */
async function digestGet(){
  if (!KV_ENABLED) return null;
  try{
    const url = KV_URL.replace(/\/+$/, '') + '/get/' + encodeURIComponent(DIGEST_KEY);
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + KV_TOKEN }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json && (json.result || (json.data && json.data.value));
    if (raw === null || raw === undefined || raw === '') return null;
    return JSON.parse(raw);
  }catch(e){
    console.error('[mailer] digest read failed: ' + e.message);
    return null;
  }
}

async function digestSet(d){
  if (!KV_ENABLED) return;
  try{
    const url = KV_URL.replace(/\/+$/, '') + '/set/' + encodeURIComponent(DIGEST_KEY);
    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
      signal: AbortSignal.timeout(8000)
    });
  }catch(e){
    console.error('[mailer] digest write failed: ' + e.message);
  }
}

const COLLECTION_LABEL = {
  prompts: 'Prompt', templates: 'Template',
  videoTemplates: 'Video template', thumbnailTemplates: 'Thumbnail template',
  psdTemplates: 'PSD template'
};

async function recordActivity(collection, action, title){
  if (!KV_ENABLED) return;
  const d = await digestGet() || { since: new Date().toISOString(), activities: {} };
  const label = (COLLECTION_LABEL[collection] || collection) + ' · ' + title;
  const key = action + ':' + label;
  d.activities[key] = (d.activities[key] || 0) + 1;
  await digestSet(d);
}

async function flushDigest(){
  if (!KV_ENABLED) return { sent: false, reason: 'kv_off', events: 0 };
  const d = await digestGet();
  if (!d || !d.activities || Object.keys(d.activities).length === 0){
    return { sent: false, reason: 'no_events', events: 0 };
  }
  const entries = Object.keys(d.activities)
    .map((k) => ({ raw: k, n: d.activities[k] }));
  const kinds = {};
  for (const e of entries){
    const sep = e.raw.indexOf(':');
    const action = e.raw.slice(0, sep);
    const label = e.raw.slice(sep + 1);
    (kinds[action] = kinds[action] || []).push({ label, n: e.n });
  }
  let html = '<p style="margin-top:0;font-size:15px">Activity summary since <b>' + esc(d.since) + '</b>:</p>';
  const order = ['view', 'download'];
  for (const a of order){
    const list = (kinds[a] || []).sort((x, y) => y.n - x.n);
    if (!list.length) continue;
    html += '<h3 style="margin:18px 0 8px;font-size:15px">' + esc(a === 'view' ? 'Prompt views' : 'Downloads') + '</h3>' +
      '<table style="border-collapse:collapse;width:100%;font-size:14px">' +
      list.slice(0, 15).map(function(x){
        return '<tr><td style="padding:6px 10px;border:1px solid #e5e7eb">' + esc(x.label) + '</td>' +
          '<td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:right;width:70px;background:#f9fafb">' + x.n + '</td></tr>';
      }).join('') + '</table>';
  }
  if (html.indexOf('table') === -1){
    html += '<p>No views or downloads recorded.</p>';
  }
  const sent = await sendMail({
    subject: 'YallahClick - Daily activity digest',
    html: layout('YallahClick - Daily activity digest', html)
  });
  await digestSet({ since: new Date().toISOString(), activities: {} });
  return { sent, reason: sent ? 'sent' : 'mail_off', events: entries.reduce((s, e) => s + e.n, 0) };
}

module.exports = {
  configured: () => !!(USER && PASS && TO),
  sendMail,
  notifyBooking,
  recordActivity,
  flushDigest,
  DIGEST_KEY,
};