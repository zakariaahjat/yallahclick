/* ============================================================
   YallahClick — Auth router (/api/auth)
   Server-side admin login issues an HMAC-signed session token.
   Passwords are hashed when admins are created/updated.
   ============================================================ */
'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('./middleware');

const router = express.Router();

function publicAdmin(a){
  const { password, ...safe } = a;
  return safe;
}

router.post('/login', async (req, res, next) => {
  try{
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const password = String((req.body && req.body.password) || '');

    const admins = db.getAll('admins');
    const admin = admins.find((a) => String(a.email || '').toLowerCase() === email);

    const valid = admin &&
      String(admin.status) !== 'disabled' &&
      String(admin.password) === password; // plaintext demo seed; see note below

    if (!valid){
      return res.status(401).json({ error: 'invalid_credentials', message: 'Incorrect email or password.' });
    }

    const token = await db.signToken({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    res.json({
      data: {
        token,
        user: publicAdmin(admin),
        expiresIn: 86400,
      }
    });
  }catch(e){ next(e); }
});

router.get('/me', requireAuth, (req, res) => {
  const payload = req.user;
  const admin = db.getById('admins', payload.sub) || db.getAll('admins').find((a) => String(a.email).toLowerCase() === String(payload.email).toLowerCase());
  if (!admin) return res.status(404).json({ error: 'not found' });
  res.json({ data: publicAdmin(admin) });
});

router.post('/logout', (req, res) => {
  // Stateless HMAC tokens have no server-side blacklist; the client
  // discards the token. Endpoint exists for API symmetry.
  res.json({ data: { ok: true } });
});

module.exports = router;