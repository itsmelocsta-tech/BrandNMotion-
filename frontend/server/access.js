import { createHash, timingSafeEqual } from 'node:crypto';

// Server-only secret. Never use a VITE_ variable, URL, or browser storage.
export function requireOwner(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const expected = process.env.BNM_OWNER_TOKEN;
  if (!expected || expected.length < 32) {
    res.status(503).json({ error: 'Owner access needs server configuration.', code: 'OWNER_SETUP_REQUIRED' });
    return false;
  }
  const header = req.headers?.authorization;
  const supplied = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  const digest = value => createHash('sha256').update(value).digest();
  if (!supplied || supplied.length > 512 || !timingSafeEqual(digest(supplied), digest(expected))) {
    res.status(401).json({ error: 'Unlock owner access to use connected services.', code: 'OWNER_ACCESS_REQUIRED' });
    return false;
  }
  return true;
}

export function allowVideoSubmission(res) {
  // The approved budget is $0. A flag or client checkbox cannot override it.
  // Paid use requires a durable atomic spend ledger and approved server quotes.
  res.status(403).json({ error: 'Video generation is paused under your $0 budget. No provider request was sent.', code: 'ZERO_SPEND_LIMIT' });
  return false;
}
