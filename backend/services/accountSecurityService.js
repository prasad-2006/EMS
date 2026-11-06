const crypto = require('crypto');
const UserSession = require('../models/UserSession');
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const hashSessionId = (sessionId) => crypto.createHash('sha256').update(sessionId).digest('hex');

const parseTokenExpiry = (token) => {
  const decoded = token && token.split('.').length === 3
    ? JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    : null;
  return decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
};

const createSession = async ({ userId, sessionId, token, req }) => UserSession.create({
  userId,
  tokenHash: hashSessionId(sessionId),
  deviceName: req.headers['x-device-name'] || 'Unknown device',
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip,
  expiresAt: parseTokenExpiry(token)
});

const revokeSession = async (userId, sessionId) => {
  const result = await UserSession.updateOne(
    { userId, tokenHash: hashSessionId(sessionId), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return result.modifiedCount > 0;
};

const revokeAllOtherSessions = async (userId, currentSessionId) => UserSession.updateMany(
  { userId, tokenHash: { $ne: hashSessionId(currentSessionId) }, revokedAt: null },
  { $set: { revokedAt: new Date() } }
);

const revokeAllSessions = async (userId) => UserSession.updateMany(
  { userId, revokedAt: null },
  { $set: { revokedAt: new Date() } }
);

const encodeBase32 = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
};

const decodeBase32 = (value) => {
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const char of value.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error('Invalid MFA secret');
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
};

const encryptMfaSecret = (secret) => {
  const key = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'development-secret').digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
};

const decryptMfaSecret = (value) => {
  const [ivHex, tagHex, encryptedHex] = value.split(':');
  const key = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'development-secret').digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
};

const getTotpCode = (secret, counter) => {
  const key = decodeBase32(secret);
  const message = Buffer.alloc(8);
  message.writeBigInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(code).padStart(6, '0');
};

const verifyTotpCode = (secret, token, timestamp = Date.now()) => {
  const counter = Math.floor(timestamp / 30000);
  return [-1, 0, 1].some((offset) => getTotpCode(secret, counter + offset) === String(token));
};

const consumeRecoveryCode = (user, code) => {
  const hash = crypto.createHash('sha256').update(String(code || '')).digest('hex');
  const index = (user.mfaRecoveryCodeHashes || []).indexOf(hash);
  if (index < 0) return false;
  user.mfaRecoveryCodeHashes.splice(index, 1);
  return true;
};

module.exports = {
  hashSessionId,
  hashSessionId,
  createSession,
  revokeSession,
  revokeAllOtherSessions,
  revokeAllSessions,
  encodeBase32,
  encryptMfaSecret,
  decryptMfaSecret,
  verifyTotpCode,
  consumeRecoveryCode
};
