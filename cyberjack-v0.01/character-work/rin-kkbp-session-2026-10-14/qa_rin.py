#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""QA Rin_vrm via vrm-toolkit-mcp (MCP stdio client)."""
import json
import subprocess
import sys
import os

VRM = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/rin-kkbp-session-2026-10-14/Rin_KKBP_v1.vrm"
OUTDIR = os.path.dirname(VRM)


class MCP:
    def __init__(self):
        self.proc = subprocess.Popen(
            ["npx", "-y", "vrm-toolkit-mcp"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True, bufsize=1)
        self.i = 0

    def send(self, method, params=None, notify=False):
        self.i += 1
        msg = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            msg["params"] = params
        msg["id"] = None if notify else self.i
        self.proc.stdin.write(json.dumps(msg) + "\n")
        self.proc.stdin.flush()
        if notify:
            return None
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError("server closed")
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except Exception:
                continue
            if data.get("id") == self.i:
                return data


def main():
    mc = MCP()
    init = mc.send("initialize", {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "qa", "version": "1"},
    })
    name = init["result"]["serverInfo"]["name"]
    mc.send("notifications/initialized", notify=True)
    print("server:", name, flush=True)

    tools = mc.send("tools/list", {})["result"]["tools"]
    print("tools:", [t["name"] for t in tools], flush=True)

    ins = mc.send("tools/call", {"name": "vrm_inspect", "arguments": {"path": VRM}})
    txt = ins["result"]["content"][0]["text"]
    with open(os.path.join(OUTDIR, "qa_inspect.json"), "w") as f:
        f.write(txt)
    print("INSPECT OK, saved qa_inspect.json", flush=True)
    val = mc.send("tools/call", {"name": "vrm_validate", "arguments": {"path": VRM}})
    vtxt = val["result"]["content"][0]["text"]
    with open(os.path.join(OUTDIR, "qa_validate.txt"), "w") as f:
        f.write(vtxt)
    print("VALIDATE (first 1500):", vtxt[:1500], flush=True)

    for view, fname in (("front", "qa_front.png"),
                        ("three_quarter", "qa_three_quarter.png")):
        try:
            snap = mc.send("tools/call", {"name": "vrm_snapshot", "arguments": {
                "path": VRM, "view": view, "out": os.path.join(OUTDIR, fname)}})
            out = json.dumps(snap.get("result", {}), ensure_ascii=False)[:300]
            print(f"SNAP {view}: {out}", flush=True)
            if os.path.exists(os.path.join(OUTDIR, fname)):
                print(f"  file: {fname} {os.path.getsize(os.path.join(OUTDIR,fname))}",
                      flush=True)
        except Exception as e:
            print(f"SNAP {view} ERR: {e}", flush=True)
    mc.proc.terminate()
    print("QA_DONE", flush=True)


main()