// Simple Yahoo Finance proxy — no API key needed
// Vercel serverless function: /api/prices?symbols=RELIANCE,INFY,SBIN

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'Pass ?symbols=RELIANCE,INFY' });

  const tickers = symbols.split(',').map(s => s.trim() + '.NS'); // .NS = NSE

  try {
    const results = {};
    await Promise.all(tickers.map(async ticker => {
      try {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const d = await r.json();
        const meta = d.chart?.result?.[0]?.meta;
        if (meta) {
          const sym = ticker.replace('.NS', '');
          results[sym] = {
            price: meta.regularMarketPrice,
            prevClose: meta.previousClose || meta.chartPreviousClose,
            change: meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose),
            changePct: ((meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose)) / (meta.previousClose || meta.chartPreviousClose) * 100),
            high: meta.regularMarketDayHigh,
            low: meta.regularMarketDayLow,
            open: meta.regularMarketOpen,
            volume: meta.regularMarketVolume,
            name: meta.longName || meta.shortName || sym,
            exchange: meta.exchangeName,
            marketState: meta.marketState // REGULAR, PRE, POST, CLOSED
          };
        }
      } catch(e) {
        // skip failed ticker
      }
    }));

    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      prices: results
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
