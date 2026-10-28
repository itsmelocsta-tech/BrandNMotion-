export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({configured: Boolean((process.env.GOOGLE_MAPS_API_KEY || process.env.Google_Maps_API_Key))});
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed.'});
  const address = req.body?.address;
  if (typeof address !== 'string' || !address.trim() || address.length > 300) return res.status(400).json({error: 'Enter an address under 300 characters.'});
  const key = (process.env.GOOGLE_MAPS_API_KEY || process.env.Google_Maps_API_Key);
  if (!key) return res.status(503).json({error: 'Google Maps address lookup is awaiting setup. You can still plan B-roll without a location.'});
  try {
    const query = new URLSearchParams({address: address.trim(), key});
    const upstream = await fetch('https://maps.googleapis.com/maps/api/geocode/json?' + query, {signal: AbortSignal.timeout(10000)});
    const data = await upstream.json();
    if (!upstream.ok || !['OK','ZERO_RESULTS'].includes(data.status)) return res.status(502).json({error: 'Google Maps could not resolve this address. Check service access and quota.'});
    return res.status(200).json({locations: (data.results || []).slice(0,5).map(item => ({address: item.formatted_address, placeId: item.place_id, lat: item.geometry.location.lat, lng: item.geometry.location.lng, approximate: Boolean(item.partial_match) || item.geometry.location_type !== 'ROOFTOP', mapsUrl: 'https://www.google.com/maps/search/?' + new URLSearchParams({api:'1',query:item.formatted_address,query_place_id:item.place_id})}))});
  } catch { return res.status(502).json({error: 'Address lookup timed out or could not connect. Try again.'}); }
}
