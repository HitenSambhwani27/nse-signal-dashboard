import json, sqlite3, time, urllib.request, subprocess
from pathlib import Path
API="http://127.0.0.1:8080"
DB="/home/nse/nse-signal-pipeline/data/nse_pipeline.db"
tokens=(12124930,12144898,256265)

def get(path, timeout=15):
    req=urllib.request.Request(API+path, headers={"Accept":"application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

time.sleep(15)
conn=sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
rows={}
for t in tokens:
    rows[t]=conn.execute("SELECT instrument_token,symbol,last_price,timestamp,ingested_at FROM latest_quotes WHERE instrument_token=?", (t,)).fetchone()
wal=Path(DB+"-wal")
health=get("/api/v1/health")
# Last-Event-ID exact continuity
import urllib.request as u
url=API+"/api/v1/stream?tokens=256265&groups=price"
req=u.Request(url, headers={"Accept":"text/event-stream"})
last_id=None
buf=""
with u.urlopen(req, timeout=8) as resp:
    t0=time.time()
    while time.time()-t0<3:
        chunk=resp.read(1024)
        if not chunk: break
        buf += chunk.decode("utf-8","replace")
        while "\n\n" in buf:
            raw,buf=buf.split("\n\n",1)
            evid=None; ev="message"
            for line in raw.splitlines():
                if line.startswith("id:"): evid=line[3:].strip()
                if line.startswith("event:"): ev=line[6:].strip()
            if ev=="tick" and evid: last_id=evid
hdrs={"Accept":"text/event-stream","Last-Event-ID": str(last_id or "0")}
req2=u.Request(url, headers=hdrs)
resync=None; hello=False
buf=""
with u.urlopen(req2, timeout=8) as resp:
    t0=time.time()
    while time.time()-t0<3:
        chunk=resp.read(1024)
        if not chunk: break
        buf += chunk.decode("utf-8","replace")
        while "\n\n" in buf:
            raw,buf=buf.split("\n\n",1)
            ev="message"; data={}
            for line in raw.splitlines():
                if line.startswith("event:"): ev=line[6:].strip()
                if line.startswith("data:"):
                    try: data=json.loads(line[5:].lstrip())
                    except Exception: pass
            if ev=="hello": hello=True
            if ev=="resync": resync=data
# release near token
body=json.dumps({"token":12124930,"requester":"phase5-near","action":"release","capabilities":["price"]}).encode()
req=u.Request(API+"/api/v1/subscriptions", data=body, headers={"Content-Type":"application/json","Accept":"application/json"}, method="POST")
with u.urlopen(req, timeout=10) as r:
    released=json.loads(r.read().decode())
time.sleep(2)
conn2=sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
subs=list(conn2.execute("SELECT token,requester,status FROM subscription_requests"))
conn2.close()
ps=subprocess.check_output(["bash","-lc","ps -p 159891 -o pid,pcpu,pmem,rss,etime --no-headers; pgrep -af '[p]ython .*01_run_ingestion.py'"], text=True)
out={
 "quotes": {str(k): (list(v) if v else None) for k,v in rows.items()},
 "wal": wal.stat().st_size if wal.exists() else 0,
 "stream": (health.get("health") or {}).get("stream"),
 "busy": (health.get("health") or {}).get("sqlite_busy_retries"),
 "last_id": last_id,
 "reconnect_hello": hello,
 "reconnect_resync": resync,
 "released": released,
 "subs": [list(s) for s in subs],
 "ps": ps,
}
print(json.dumps(out, indent=2, default=str))
Path("/tmp/phase5_final_bits.json").write_text(json.dumps(out, indent=2, default=str))
