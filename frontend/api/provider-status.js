import { requireOwner } from '../server/access.js';

// Read-only Google credential check: never starts text or video generation.
export default async function handler(req, res) {
  if (!requireOwner(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ code: 'CREDENTIAL_MISSING' });
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY }, signal: AbortSignal.timeout(15000)
    });
    return res.status(response.ok ? 200 : 502).json({
      googleModelListingAccepted: response.ok, providerStatus: response.status,
      generationAccessVerified: false, balanceVerified: false, exactCostVerified: false,
      videoPlaybackVerified: false, videoBudgetUsd: 0
    });
  } catch {
    return res.status(502).json({ code: 'PROVIDER_UNREACHABLE' });
  }
}
