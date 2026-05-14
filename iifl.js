/**
 * IIFL Markets API Proxy — Vercel Serverless Function
 * File: api/iifl.js
 * 
 * This acts as a middleman between your dashboard (browser) and IIFL's API.
 * Needed because browsers block direct API calls (CORS policy).
 * 
 * Deploy this to Vercel (free) — takes 3 minutes.
 */

export default async function handler(req, res) {

  // ── CORS headers — allow your dashboard to call this proxy ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── Read which IIFL endpoint to call ──
  const { endpoint } = req.query;

  // ── Your IIFL API credentials (set these in Vercel Environment Variables) ──
  const API_KEY    = process.env.IIFL_API_KEY;
  const API_SECRET = process.env.IIFL_API_SECRET;

  if (!API_KEY || !API_SECRET) {
    return res.status(500).json({
      error: 'IIFL API credentials not configured.',
      hint: 'Set IIFL_API_KEY and IIFL_API_SECRET in Vercel Environment Variables.'
    });
  }

  const BASE = 'https://ttblaze.iifl.com/apimarketdata';

  try {

    // ────────────────────────────────────────────────────────────
    // STEP 1: LOGIN — get a session token
    // Called once per session. Token expires daily.
    // ────────────────────────────────────────────────────────────
    if (endpoint === 'login') {
      const loginRes = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secretKey: API_SECRET,
          appKey: API_KEY,
          source: 'WebAPI'
        })
      });
      const loginData = await loginRes.json();
      return res.status(200).json(loginData);
    }

    // ── All other endpoints need a token passed from the dashboard ──
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token. Call /api/iifl?endpoint=login first.' });
    }

    const authHeaders = {
      'Content-Type': 'application/json',
      'authorization': token
    };

    // ────────────────────────────────────────────────────────────
    // STEP 2: QUOTE — live price for one or more stocks
    // Pass instruments as query: ?endpoint=quote&instruments=RELIANCE:NSE,INFY:NSE
    // ────────────────────────────────────────────────────────────
    if (endpoint === 'quote') {
      const rawInstruments = req.query.instruments || '';
      // Format: "SYMBOL:EXCHANGE" → [{exchangeSegment:1, exchangeInstrumentID: <id>}]
      // We use a symbol→ID map for your portfolio stocks
      const instruments = rawInstruments.split(',').map(i => {
        const [symbol, exchange] = i.split(':');
        return {
          exchangeSegment: exchange === 'BSE' ? 11 : 1, // 1=NSE, 11=BSE
          exchangeInstrumentID: SYMBOL_TO_ID[symbol] || symbol
        };
      }).filter(i => i.exchangeInstrumentID);

      const quoteRes = await fetch(`${BASE}/instruments/quotes`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          instruments,
          xtsMessageCode: 1502, // Touchline quote type
          publishFormat: 'JSON'
        })
      });
      const quoteData = await quoteRes.json();
      return res.status(200).json(quoteData);
    }

    // ────────────────────────────────────────────────────────────
    // STEP 3: HOLDINGS — fetch real portfolio from IIFL
    // ────────────────────────────────────────────────────────────
    if (endpoint === 'holdings') {
      const holdRes = await fetch(
        'https://ttblaze.iifl.com/interactive/portfolio/holdings',
        { method: 'GET', headers: authHeaders }
      );
      const holdData = await holdRes.json();
      return res.status(200).json(holdData);
    }

    // ────────────────────────────────────────────────────────────
    // STEP 4: OHLC (candle data) — for technical analysis
    // ────────────────────────────────────────────────────────────
    if (endpoint === 'ohlc') {
      const { instrumentID, exchange, interval, from, to } = req.query;
      const ohlcRes = await fetch(
        `${BASE}/instruments/ohlc?exchangeSegment=${exchange === 'BSE' ? 11 : 1}&exchangeInstrumentID=${instrumentID}&startTime=${from}&endTime=${to}&compressionValue=${interval || 60}`,
        { method: 'GET', headers: authHeaders }
      );
      const ohlcData = await ohlcRes.json();
      return res.status(200).json(ohlcData);
    }

    return res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });

  } catch (err) {
    console.error('IIFL Proxy Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── NSE Instrument IDs for Mayank's portfolio ──────────────────────────────
// These are IIFL's internal instrument IDs for each stock on NSE
// (exchangeInstrumentID from IIFL's instrument master CSV)
const SYMBOL_TO_ID = {
  'CIPLA':       1660,
  'SUNPHARMA':   3351,
  'BHEL':        526,
  'URJA':        14418,
  'APOLLO':      877,
  'SBIN':        3045,
  'FEDERALBNK':  1895,
  'POONAWALLA':  7893,
  'GEOJITFSL':   2061,
  'IIFL':        20374,
  'M&MFIN':      2513,
  'IDFCFIRSTB':  11184,
  'IIFLCAPS':    1232,
  'LICI':        21808,
  'IREDA':       26000,
  'TATACAP':     25000,
  'HCC':         1467,
  'IRB':         19821,
  'HGINFRA':     19584,
  'INFY':        1594,
  'HCLTECH':     7229,
  '3IINFOLTD':   29048,
  'POLICYBZR':   21514,
  'RELINFRA':    2882,
  'TATAPOWER':   3426,
  'NLCINDIA':    20669,
  'GAIL':        1975,
  'NHPC':        20286,
  'TMPV':        3456,
  'HYUNDAI':     26027,
  'TMCV':        3432,
  'TATACONSUM':  3432,
  'ITC':         1660,
  'VIPIND':      4254,
  'MMTC':        2651,
  'HINDCOPPER':  19672,
  'COALINDIA':   20374,
  'BALMLAWRIE':  499,
  'JMFINANCIL':  2019,
  'ABCAPITAL':   18534,
  'PETRONET':    15083,
  'IDEA':        14366,
  'IRCTC':       20296,
  'ETERNAL':     25960,
  'SWIGGY':      26209,
  'BSE':         25044,
  'MON100':      20597,
  'PHARMABEES':  16675,
};
