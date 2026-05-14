// FIXED v3 — correct login format + source field
module.exports = async function handler(req, res) {

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { endpoint } = req.query;
  const API_KEY    = process.env.IIFL_API_KEY;
  const API_SECRET = process.env.IIFL_API_SECRET;
  const BASE = 'https://ttblaze.iifl.com/apimarketdata';

  // Quick health check — visit /api/iifl?endpoint=ping to confirm it's working
  if (endpoint === 'ping') {
    return res.status(200).json({ 
      status: 'ok', 
      hasKey: !!API_KEY, 
      hasSecret: !!API_SECRET,
      message: 'IIFL Proxy is running!' 
    });
  }

  if (!API_KEY || !API_SECRET) {
    return res.status(500).json({
      error: 'Missing credentials',
      hint: 'Add IIFL_API_KEY and IIFL_API_SECRET in Vercel Environment Variables, then redeploy.'
    });
  }

  try {

    // LOGIN
    if (endpoint === 'login') {
      const loginRes = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secretKey: API_SECRET,
          appKey: API_KEY
        })
      });
      const data = await loginRes.json();
      return res.status(200).json(data);
    }

    // All other endpoints need a session token
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token. Call ?endpoint=login first.' });
    }

    const authHeaders = {
      'Content-Type': 'application/json',
      'authorization': token
    };

    // QUOTES — live prices
    if (endpoint === 'quote') {
      const rawInstruments = req.query.instruments || '';
      const instruments = rawInstruments.split(',').map(sym => ({
        exchangeSegment: 1, // NSE
        exchangeInstrumentID: SYMBOL_TO_ID[sym.split(':')[0]] || sym
      })).filter(i => i.exchangeInstrumentID);

      const quoteRes = await fetch(`${BASE}/instruments/quotes`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          instruments,
          xtsMessageCode: 1502,
          publishFormat: 'JSON'
        })
      });
      const data = await quoteRes.json();
      return res.status(200).json(data);
    }

    // HOLDINGS
    if (endpoint === 'holdings') {
      const r = await fetch('https://ttblaze.iifl.com/interactive/portfolio/holdings', {
        method: 'GET',
        headers: authHeaders
      });
      return res.status(200).json(await r.json());
    }

    return res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// NSE Instrument IDs for Mayank's portfolio
const SYMBOL_TO_ID = {
  'CIPLA':1660,'SUNPHARMA':3351,'BHEL':526,'URJA':14418,'APOLLO':877,
  'SBIN':3045,'FEDERALBNK':1895,'POONAWALLA':7893,'GEOJITFSL':2061,
  'IIFL':20374,'M&MFIN':2513,'IDFCFIRSTB':11184,'IIFLCAPS':1232,
  'LICI':21808,'IREDA':26000,'TATACAP':25000,'HCC':1467,'IRB':19821,
  'HGINFRA':19584,'INFY':1594,'HCLTECH':7229,'POLICYBZR':21514,
  'RELINFRA':2882,'TATAPOWER':3426,'NLCINDIA':20669,'GAIL':1975,
  'NHPC':20286,'TATACONSUM':3432,'ITC':1660,'VIPIND':4254,'MMTC':2651,
  'HINDCOPPER':19672,'COALINDIA':20374,'ABCAPITAL':18534,'PETRONET':15083,
  'IDEA':14366,'IRCTC':20296,'ETERNAL':25960,'SWIGGY':26209,
  'VIKRAMSOLR':26100,'BSE':25044,'MON100':20597,'PHARMABEES':16675,
};
