#!/usr/bin/env python3
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import argparse
parser=argparse.ArgumentParser(description="Локальный VRM-вьювер Rin и Mira")
parser.add_argument("--port",type=int,default=8766)
args=parser.parse_args()
root=Path(__file__).resolve().parent
server=ThreadingHTTPServer(("127.0.0.1",args.port),partial(SimpleHTTPRequestHandler,directory=str(root)))
print(f"Rin:  http://127.0.0.1:{args.port}/vrm_view.html?vrm=models/x20/outfits/Rin_outfit_00.vrm",flush=True)
print(f"Mira: http://127.0.0.1:{args.port}/vrm_view.html?vrm=models/x20/mira/Mira_outfit_00.vrm",flush=True)
try: server.serve_forever()
except KeyboardInterrupt: pass
finally: server.server_close()
