#!/usr/bin/env python3
"""CDP QA for components.html catalog cards (renders previews)."""
import json, os, subprocess, threading, time, urllib.request, sys
import websocket

URL = "http://127.0.0.1:8088/models/machine-modules/components.html"
OUT = os.path.dirname(os.path.abspath(__file__))
PORT = 9333


class CDP:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=30, max_size=64 * 1024 * 1024)
        self.id = 0
        self.events = []
        self.lock = threading.Lock()
        self.responses = {}
        self.ev_handlers = {}

    def send(self, method, **params):
        self.id += 1
        mid = self.id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})
            self._event(msg)

    def _event(self, msg):
        self.events.append(msg)
        for h in self.ev_handlers.get(msg.get("method"), []):
            h(msg.get("params", {}))

    def pump(self, seconds):
        end = time.time() + seconds
        self.ws.settimeout(0.2)
        while time.time() < end:
            try:
                self._event(json.loads(self.ws.recv()))
            except websocket.WebSocketTimeoutException:
                pass
            except Exception:
                break
        self.ws.settimeout(30)

    def on(self, method, fn):
        self.ev_handlers.setdefault(method, []).append(fn)

    def eval(self, expr, await_promise=False):
        r = self.send("Runtime.evaluate", expression=expr, returnByValue=True,
                      awaitPromise=await_promise)
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"])
        return r["result"].get("value")


def main():
    profile = os.path.join(OUT, "_chromeprofile")
    proc = subprocess.Popen([
        "chromium", "--headless=new", f"--remote-debugging-port={PORT}",
        f"--user-data-dir={profile}", "--no-first-run", "--no-default-browser-check",
        "--disable-dev-shm-usage", "--hide-scrollbars", "--force-device-scale-factor=1",
        "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(60):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=1) as f:
                    ws_url = json.load(f)["webSocketDebuggerUrl"]
                break
            except Exception:
                time.sleep(0.25)
        assert ws_url, "chromium did not start"
        c = CDP(ws_url)
        tgt = c.send("Target.createTarget", url="about:blank")["targetId"]
        sess = c.send("Target.attachToTarget", targetId=tgt, flatten=True)["sessionId"]

        # flatten: route session messages manually
        class Sess:
            def __init__(s, cdp, sid):
                s.cdp, s.sid, s.id = cdp, sid, 100000
                s.events = []
                s.failed = []
                s.console = []
                s.exceptions = []
                s.resp = {}
                s.reqs = {}

            def send(s, method, **params):
                s.id += 1
                mid = s.id
                s.cdp.ws.send(json.dumps({"id": mid, "sessionId": s.sid, "method": method, "params": params}))
                while True:
                    msg = json.loads(s.cdp.ws.recv())
                    if msg.get("id") == mid:
                        if "error" in msg:
                            raise RuntimeError(f"{method}: {msg['error']}")
                        return msg.get("result", {})
                    s.handle(msg)

            def handle(s, msg):
                m = msg.get("method", "")
                p = msg.get("params", {})
                if m == "Network.responseReceived":
                    r = p["response"]
                    s.resp[r["url"]] = r["status"]
                elif m == "Network.loadingFailed":
                    s.failed.append(p.get("errorText"))
                elif m == "Runtime.consoleAPICalled" and p.get("type") in ("error", "warning"):
                    s.console.append((p.get("type"), [a.get("value") for a in p.get("args", [])]))
                elif m == "Runtime.exceptionThrown":
                    d = p.get("exceptionDetails", {})
                    s.exceptions.append(d.get("text") or str(d.get("exception", {}).get("description")))
                elif m == "Log.entryAdded":
                    e = p.get("entry", {})
                    if e.get("level") == "error":
                        s.console.append(("log-error", [e.get("text"), e.get("url")]))

            def pump(s, seconds):
                end = time.time() + seconds
                s.cdp.ws.settimeout(0.2)
                while time.time() < end:
                    try:
                        s.handle(json.loads(s.cdp.ws.recv()))
                    except websocket.WebSocketTimeoutException:
                        pass
                    except Exception:
                        break
                s.cdp.ws.settimeout(30)

            def ev(s, expr, await_promise=False):
                r = s.send("Runtime.evaluate", expression=expr, returnByValue=True,
                           awaitPromise=await_promise)
                if "exceptionDetails" in r:
                    raise RuntimeError(json.dumps(r["exceptionDetails"])[:600])
                return r["result"].get("value")

        s = Sess(c, sess)
        for dom in ("Page", "Network", "Runtime", "Log"):
            s.send(f"{dom}.enable")

        def metrics(w, h, mobile=False, dpr=1):
            s.send("Emulation.setDeviceMetricsOverride", width=w, height=h,
                   deviceScaleFactor=dpr, mobile=mobile)

        def shot(name, w, h, y=0, mobile=False):
            metrics(w, h, mobile)
            s.ev(f"window.scrollTo(0,{y})")
            s.pump(0.9)
            data = s.send("Page.captureScreenshot", format="png", captureBeyondViewport=False)["data"]
            import base64
            path = os.path.join(OUT, name)
            open(path, "wb").write(base64.b64decode(data))
            return path

        metrics(1440, 1000)
        s.send("Page.navigate", url=URL)
        s.pump(4.0)
        s.ev("document.readyState")

        # scroll through whole page to trigger lazy images
        height = s.ev("document.documentElement.scrollHeight")
        y = 0
        while y < height:
            s.ev(f"window.scrollTo(0,{y})")
            s.pump(0.35)
            y += 700
            height = s.ev("document.documentElement.scrollHeight")
        s.ev("window.scrollTo(0,0)")
        s.pump(2.5)

        def stats(tag):
            js = """(() => {
              const cards=[...document.querySelectorAll('.card')];
              const imgs=[...document.querySelectorAll('.card .shot')];
              const wraps=[...document.querySelectorAll('.card .shot-wrap')];
              const loaded=imgs.filter(i=>i.complete&&i.naturalWidth>0);
              const broken=imgs.filter(i=>i.complete&&i.naturalWidth===0);
              const svgFallback=wraps.filter(w=>w.classList.contains('is-svg'));
              const iconVisible=wraps.filter(w=>{const ic=w.querySelector('.icon');return ic&&getComputedStyle(ic).display!=='none';});
              const sizes=imgs.slice(0,5).map(i=>{const r=i.getBoundingClientRect();const v=i.closest('.card-visual').getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),vw:Math.round(v.width),vh:Math.round(v.height)};});
              return {cards:cards.length, imgs:imgs.length, loaded:loaded.length, broken:broken.length,
                svgFallback:svgFallback.length, iconVisible:iconVisible.length,
                count:document.getElementById('count').textContent.trim(),
                firstSrc: imgs[0]&&imgs[0].getAttribute('src'), sizes,
                overflow: imgs.filter(i=>{const r=i.getBoundingClientRect();const v=i.closest('.card-visual').getBoundingClientRect();return r.top<v.top-1||r.bottom>v.bottom+1;}).length,
                docH: document.documentElement.scrollHeight, docW: document.documentElement.scrollWidth, winW: innerWidth};
            })()"""
            return s.ev(js)

        r = {"default": stats("default")}
        p1 = shot("qa-desktop-top.png", 1440, 1000, 0)

        # explicit check: all 96 render files load from the real catalog list
        allimgs = s.ev("""(async () => {
          const ids = [...document.querySelectorAll('.card')].map(c=>c.dataset.id);
          const extra = ['structure_base'];
          const urls = ids.map(id => `renders/${id}.webp?v=20261111-renders1`);
          const res = await Promise.all(urls.map(u => new Promise(res => {
            const i = new Image();
            i.onload = () => res({u, ok: i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight});
            i.onerror = () => res({u, ok: false});
            i.src = u;
          })));
          return {total: res.length, ok: res.filter(x=>x.ok).length, bad: res.filter(x=>!x.ok).map(x=>x.u),
                  dims: [...new Set(res.filter(x=>x.ok).map(x=>x.w+'x'+x.h))]};
        })()""", await_promise=True)
        r["allRenders"] = allimgs

        # hard-badge card position
        hy = s.ev("""(()=>{const c=[...document.querySelectorAll('.card')].find(x=>x.querySelector('.vbadge'));if(!c)return null;const r=c.getBoundingClientRect();return {id:c.dataset.id,y:r.top+scrollY,cls:c.className,src:(c.querySelector('.shot')||{}).currentSrc||''};})()""")
        r["hardCard"] = hy
        p2 = shot("qa-desktop-hard.png", 1440, 1000, max(0, int(hy["y"]) - 320) if hy else 0)

        # archive toggle
        s.ev("""(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Архив/i.test(x.textContent));if(b){b.click();return true}return false})()""")
        s.pump(1.5)
        s.ev("window.scrollTo(0,0)")
        s.pump(0.4)
        arch = s.ev("""(()=>{const cards=[...document.querySelectorAll('.card')];const a=cards.filter(c=>c.classList.contains('is-archived'));const imgs=a.map(c=>c.querySelector('.shot')).filter(Boolean);return {cards:cards.length,archived:a.length,imgs:imgs.length,loaded:imgs.filter(i=>i.complete&&i.naturalWidth>0).length,count:document.getElementById('count').textContent.trim()};})()""")
        r["archiveOn"] = arch
        ay = s.ev("""(()=>{const c=[...document.querySelectorAll('.card.is-archived')][0];if(!c)return null;const r=c.getBoundingClientRect();return r.top+scrollY;})()""")
        p3 = shot("qa-desktop-archived.png", 1440, 1000, max(0, int(ay) - 160) if ay else 0)

        # mobile
        metrics(390, 844, mobile=True, dpr=2)
        s.pump(0.8)
        p4 = shot("qa-mobile-top.png", 390, 844, 0, mobile=True)
        r["mobile"] = stats("mobile")

        # 720 width check
        p5 = shot("qa-720-top.png", 720, 900, 0)

        # back to desktop, toggle archive off, open a 3D modal to ensure intact
        metrics(1440, 1000)
        s.ev("""(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Архив/i.test(x.textContent));if(b)b.click()})()""")
        s.pump(1)
        s.ev("""(()=>{const c=[...document.querySelectorAll('.card')].find(x=>/3D/.test(x.querySelector('.visual-bottom').textContent));if(c)c.click();return !!c})()""")
        s.pump(3)
        r["modal"] = s.ev("""(()=>{const m=document.getElementById('modal');const cv=document.querySelector('#d-icon canvas.detail-canvas');return {open:!!m&&m.classList.contains('open'),title:(document.querySelector('#d-title')||{}).textContent,canvas:!!cv,ready:!!cv&&cv.classList.contains('ready'),w:cv?cv.width:0,h:cv?cv.height:0};})()""")
        p6 = shot("qa-modal-3d.png", 1440, 1000, 0)

        # network summary: only renders + 200 statuses
        renders = {u.split("?")[0]: st for u, st in s.resp.items() if "/renders/" in u}
        bad = {u: st for u, st in s.resp.items() if st >= 400}
        r["net"] = {"renderRequests": len(renders), "renderNon200": {u: st for u, st in renders.items() if st != 200},
                    "bad": bad, "failed": s.failed, "console": s.console, "exceptions": s.exceptions}
        r["shots"] = [p1, p2, p3, p4, p5, p6]
        open(os.path.join(OUT, "qa-cards.json"), "w").write(json.dumps(r, ensure_ascii=False, indent=1))
        print(json.dumps(r, ensure_ascii=False, indent=1))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


main()
