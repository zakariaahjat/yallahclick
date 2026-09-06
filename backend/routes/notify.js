/* ============================================================
   YallahClick - Notification routes (/api/notify*, /api/cron/*)
   - GET  /api/cron/digest   Vercel Cron Job → emails the daily digest
   - POST /api/notify/test   owner-only → sends a test email
   ============================================================ */
'use strict';

const express = require('express');
const mailer = require('../mailer');
const { requireAuth, requireRole } = require('./middleware');

const router = express.Router();

function cronAllowed(req){
  // Vercel cron calls carry x-vercel-cron; when YC_CRON_SECRET is set we
  // additionally require it (avoids open spam endpoints behind a proxy).
  if (req.headers['x-vercel-cron'] === '1') return true;
  const secret = process.env.YC_CRON_SECRET || '';
  if (!secret) return true;
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return bearer === secret;
}

router.get('/cron/digest', async (req, res, next) => {
  try{
    if (!cronAllowed(req)) return res.status(403).json({ error: 'forbidden' });
    const out = await mailer.flushDigest();
    res.json(out);
  }catch(e){ next(e); }
});

router.post('/notify/test', requireAuth, requireRole(['owner']), async (req, res, next) => {
  try{
    if (!mailer.configured()) return res.status(501).json({ error: 'mail_not_configured', message: 'Set YC_MAIL_USER / YC_MAIL_PASS / YC_MAIL_TO first.' });
    const ok = await mailer.sendMail({
      subject: 'YallahClick - test notification',
      html: '<p style="margin-top:0">This is a test notification from your site. If you receive this email, notifications are working.</p>'
    });
    res.json({ sent: !!ok });
  }catch(e){ next(e); }
});

module.exports = router;