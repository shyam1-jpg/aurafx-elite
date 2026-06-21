/**
 * Optional AES-256-GCM encryption for sensitive registration fields at rest.
 * Set DATA_ENCRYPTION_KEY (64 hex chars = 32 bytes) in environment.
 */
const crypto = require('crypto');

const KEY_HEX = String(process.env.DATA_ENCRYPTION_KEY || '').trim();
const SENSITIVE = ['phone', 'addressLine', 'postcode'];

function enabled() {
  return /^[0-9a-fA-F]{64}$/.test(KEY_HEX);
}

function key() {
  return Buffer.from(KEY_HEX, 'hex');
}

function encryptText(plain) {
  if (!plain || !enabled()) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:v1:' + iv.toString('base64') + ':' + tag.toString('base64') + ':' + enc.toString('base64');
}

function decryptText(stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('enc:v1:')) return stored;
  if (!enabled()) return '[encrypted — set DATA_ENCRYPTION_KEY on server]';
  const parts = stored.split(':');
  if (parts.length !== 5) return stored;
  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const data = Buffer.from(parts[4], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function sealRegistration(row) {
  if (!enabled() || !row) return row;
  const out = { ...row };
  SENSITIVE.forEach((f) => {
    if (out[f]) out[f] = encryptText(out[f]);
  });
  return out;
}

function revealRegistration(row) {
  if (!row) return row;
  const out = { ...row };
  SENSITIVE.forEach((f) => {
    if (out[f]) out[f] = decryptText(out[f]);
  });
  return out;
}

function revealList(list) {
  return Array.isArray(list) ? list.map(revealRegistration) : list;
}

function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  enabled,
  sealRegistration,
  revealRegistration,
  revealList,
  generateKey
};
