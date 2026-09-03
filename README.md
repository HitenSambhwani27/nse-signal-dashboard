# NSE Signal Dashboard

Separate UI for the NSE signal pipeline. **This repo must not import `nse_pipeline`
and must not open the pipeline SQLite file.**

## Fixture mode (no VM / no API)

```powershell
cd C:\Users\sambh\nse-signal-dashboard
$env:NSE_USE_FIXTURES = "1"
# or: $env:NSE_API_URL = "mock"
streamlit run src/nse_dashboard/app.py
```

Default fixtures are suppressed: `insufficient data, 2/60 pooled days` and
`probability=null`. The maturity banner is required on every page.

## Live API (SSH tunnel to the VM)

On the VM the pipeline API binds `127.0.0.1:8080`. From the PC:

```powershell
ssh -L 8080:127.0.0.1:8080 nse@<vm-host>
$env:NSE_API_URL = "http://127.0.0.1:8080"
streamlit run src/nse_dashboard/app.py
```

Do not copy `.env`, API keys, or production SQLite here.

Until 60 pooled live days, every page shows **insufficient data, N/60 pooled days**
and never a probability.
