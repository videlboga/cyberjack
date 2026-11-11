#!/usr/bin/env python3
"""Second pass: mobile/tablet card shots, archive lazy-load, SVG fallback probe."""
import base64, json, os, subprocess, time, urllib.request
import websocket

URL = "http://127.0.0.1:8088/models/machine-modules/components.html"
OUT = os.path.dirname(os.path.abspath(__file__))
PORT = 9412


class Sess:
    def __init__(self, ws, sid):
        self.ws, self.sid, self.id = ws, sid, 100000
        self.resp, self.failed, self.console, self.exceptions = {}, [], [], []

    def send(self, method, **params):
        self.id += 1
        mid = self.id
        self.ws.send(json.dumps({"id": mid, "sessionId": self.sid, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})
            self.handle(msg)

    def handle(self, msg):
        m, p = msg.get("method", ""), msg.get("params", {})
        if m == "Network.responseReceived":
            self.resp[p["response"]["url"]] = p["response"]["status"]
        elif m == "Network.loadingFailed":
            self.failed.append(p.get("errorText"))
        elif m == "Runtime.exceptionThrown":
            d = p.get("exceptionDetails", {})
            self.exceptions.append(d.get("text") or str(d.get("exception", {}).get("description")))
        elif m == "Runtime.consoleAPICalled" and p.get("type") == "error":
            self.console.append([a.get("value") for a in p.get("args", [])])
        elif m == "Log.entryAdded" and p.get("entry", {}).get("level") == "error":
            self.console.append([p["entry"].get("text"), p["entry"].get("url")])

    def pump(self, seconds):
        end = time.time() + seconds
        self.ws.settimeout(0.2)
        while time.time() < end:
            try:
                self.handle(json.loads(self.ws.recv()))
            except websocket.WebSocketTimeoutException:
                pass
            except Exception:
                break
        self.ws.settimeout(30)

    def ev(self, expr, await_promise=False):
        r = self.send("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=await_promise)
        if "exceptionDetails" in r:
            raise RuntimeError(json.dumps(r["exceptionDetails"])[:600])
        return r["result"].get("value")


proc = subprocess.Popen(["chromium", "--headless=new", f"--remote-debugging-port={PORT}",
                         f"--user-data-dir={os.path.join(OUT,'_chromeprofile2')}",
                         "--no-first-run", "--no-default-browser-check", "--disable-dev-shm-usage",
                         "--remote-allow-origins=*", "--hide-scrollbars", "about:blank"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
res = {}
try:
    ws_url = None
    for _ in range(60):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=1) as f:
                ws_url = json.load(f)["webSocketDebuggerUrl"]
            break
        except Exception:
            time.sleep(0.25)
    ws = websocket.create_connection(ws_url, timeout=30, max_size=64 * 1024 * 1024)

    def browser(method, **params):
        global mid
        mid += 1
        ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            m = json.loads(ws.recv())
            if m.get("id") == mid:
                return m.get("result", {})

    mid = 0
    tgt = browser("Target.createTarget", url="about:blank")["targetId"]
    s = Sess(ws, browser("Target.attachToTarget", targetId=tgt, flatten=True)["sessionId"])
    for d in ("Page", "Network", "Runtime", "Log"):
        s.send(f"{d}.enable")

    def metrics(w, h, mobile=False, dpr=1):
        s.send("Emulation.setDeviceMetricsOverride", width=w, height=h, deviceScaleFactor=dpr, mobile=mobile)

    def shot(name, w, h, y, mobile=False):
        metrics(w, h, mobile)
        s.ev(f"window.scrollTo(0,{y})")
        s.pump(2.2)
        data = s.send("Page.captureScreenshot", format="png")["data"]
        p = os.path.join(OUT, name)
        open(p, "wb").write(base64.b64decode(data))
        return p

    metrics(1440, 1000)
    s.send("Page.navigate", url=URL)
    s.pump(4)

    grid_y = s.ev("document.getElementById('grid').getBoundingClientRect().top + scrollY")
    res["gridY"] = grid_y

    # mobile card shot: first rows incl. hard badge + archived toggle off
    res["mobileShot"] = shot("qa-mobile-cards.png", 390, 844, grid_y - 10, mobile=True)
    res["mobileState"] = s.ev("""(()=>{const imgs=[...document.querySelectorAll('.card .shot')];return {cards:document.querySelectorAll('.card').length,
      inView:imgs.filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0}).length,
      loadedInView:imgs.filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&i.complete&&i.naturalWidth>0}).length,
      docW:document.documentElement.scrollWidth,winW:innerWidth};})()""")

    # 720 width
    res["tabletShot"] = shot("qa-720-cards.png", 720, 900, grid_y - 10)
    res["tabletState"] = s.ev("""(()=>({docW:document.documentElement.scrollWidth,winW:innerWidth,cards:document.querySelectorAll('.card').length,
      loaded:[...document.querySelectorAll('.card .shot')].filter(i=>i.complete&&i.naturalWidth>0).length}))()""")

    # archive on -> scroll through -> count all archive images loaded
    metrics(1440, 1000)
    s.ev("""(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Архив/i.test(x.textContent));b&&b.click()})()""")
    s.pump(1.2)
    h = s.ev("document.documentElement.scrollHeight")
    y = 0
    while y < h:
        s.ev(f"window.scrollTo(0,{y})")
        s.pump(0.5)
        y += 800
        h = s.ev("document.documentElement.scrollHeight")
    s.ev("window.scrollTo(0,0)")
    s.pump(2)
    res["archive"] = s.ev("""(()=>{const a=[...document.querySelectorAll('.card.is-archived')];
      const imgs=a.map(c=>c.querySelector('.shot')).filter(Boolean);
      const all=[...document.querySelectorAll('.card .shot')];
      return {cards:document.querySelectorAll('.card').length, archived:a.length, archImgs:imgs.length,
        archLoaded:imgs.filter(i=>i.complete&&i.naturalWidth>0).length,
        allImgs:all.length, allLoaded:all.filter(i=>i.complete&&i.naturalWidth>0).length,
        archBroken:imgs.filter(i=>i.complete&&i.naturalWidth===0).length};})()""")
    ay = s.ev("""(()=>{const c=[...document.querySelectorAll('.card.is-archived')][0];return c?c.getBoundingClientRect().top+scrollY:0})()""")
    res["archShot"] = shot("qa-archived-cards.png", 1440, 1000, max(0, ay - 40))

    # SVG fallback: break one card's img
    fb = s.ev("""(async () => {
      const c=document.querySelector('.card');
      const img=c.querySelector('.shot');
      img.src='renders/__definitely_missing__.webp';
      await new Promise(r=>setTimeout(r,1200));
      const w=c.querySelector('.shot-wrap'), ic=c.querySelector('.icon'), svg=c.querySelector('.icon svg');
      const r=ic.getBoundingClientRect();
      return {svgClass:w.classList.contains('is-svg'), imgGone:!c.querySelector('.shot'),
              iconDisplay:getComputedStyle(ic).display, svg:!!svg, iconW:Math.round(r.width), iconH:Math.round(r.height),
              visible: r.width>0&&r.height>0};
    })()""", await_promise=True)
    res["fallback"] = fb
    cy = s.ev("document.querySelector('.card').getBoundingClientRect().top+scrollY")
    res["fallbackShot"] = shot("qa-svg-fallback.png", 1440, 700, max(0, cy - 20))

    res["net"] = {"non200": {u: st for u, st in s.resp.items() if st >= 400},
                  "failedCount": len(s.failed), "failed": s.failed[:5],
                  "exceptions": s.exceptions[:5], "consoleErrors": s.console[:5]}
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except Exception:
        proc.kill()

open(os.path.join(OUT, "qa2.json"), "w").write(json.dumps(res, ensure_ascii=False, indent=1))
print(json.dumps(res, ensure_ascii=False, indent=1))
