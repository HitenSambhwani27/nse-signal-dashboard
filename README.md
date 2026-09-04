# NSE Terminal

Read-only professional market terminal for the NSE signal pipeline.

This repository must **not** import `nse_pipeline`, open the pipeline SQLite file,
talk to Kite, or invent market data. The FastAPI service on `:8080` is the source of truth.

## Run the terminal

```powershell
cd C:\Users\sambh\nse-signal-dashboard
copy .env.example .env.local
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

The Next.js rewrite proxy forwards `/api/v1/*` to `API_BASE_URL` (default `http://127.0.0.1:8080`).
Leave `NEXT_PUBLIC_API_BASE_URL` empty so the browser stays same-origin and avoids CORS.

Live API through an SSH tunnel:

```powershell
ssh -L 8080:127.0.0.1:8080 nse@<vm-host>
$env:API_BASE_URL = "http://127.0.0.1:8080"
npm run dev
```

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
pytest
```

## Maturity

Until 60 pooled live days, every envelope shows **insufficient data, N/60 pooled days**.
The terminal never fabricates a probability.

## Candlesticks

`GET /api/v1/charts/{symbol}` currently returns downsampled observation points
(`last_price`, `volume`, `oi`, …), not OHLC candles. The candlestick panel stays
on an honest unavailable state until the backend exposes candle fields.

Python helpers under `src/nse_dashboard/` remain for fixture-mode pytest only.
The Streamlit UI has been retired.
