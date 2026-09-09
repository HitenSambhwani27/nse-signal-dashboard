# NSE Terminal

Read-only professional market terminal for the NSE signal pipeline.

This repository must **not** import `nse_pipeline`, open the pipeline SQLite file,
talk to Kite, or invent market data. The FastAPI service on the VM (`127.0.0.1:8080`)
is the source of truth. The dashboard never talks to that port directly.

## Run the terminal

```powershell
cd C:\Users\sambh\nse-signal-dashboard
copy .env.example .env.local
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

The Next.js `/api/v1/*` proxies forward to `API_BASE_URL`.
Application default when unset: `http://127.0.0.1:8080` (local FastAPI, no tunnel).
Leave `NEXT_PUBLIC_API_BASE_URL` empty so the browser and SharedWorker stay
same-origin and avoid CORS.

**Local FastAPI (this machine, no tunnel):**

```powershell
# .env / .env.local:
# API_BASE_URL=http://127.0.0.1:8080
npm run dev
```

**VM API through an SSH tunnel** (local `18080` → VM `8080`). The dashboard does
not create the tunnel; start it separately. Do not change the remote VM port.

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_do_nse" -L 18080:127.0.0.1:8080 nse@<vm-host>
# .env / .env.local:
# API_BASE_URL=http://127.0.0.1:18080
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
