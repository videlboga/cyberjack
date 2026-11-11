"""Local editor server with a narrowly scoped, atomic VRM export endpoint."""
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import json,struct,os,tempfile
HERE=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
 extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.vrm':'model/gltf-binary'}
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(HERE),**kwargs)
 def do_POST(self):
  if self.path!='/api/exports/vrm':self.send_error(404);return
  origin=self.headers.get('Origin')
  if origin and origin not in ('http://127.0.0.1:8767','http://localhost:8767'):self.send_error(403);return
  try:
   length=int(self.headers.get('Content-Length','0'))
   if not 20<=length<=128*1024*1024:raise ValueError('Invalid export size')
   data=self.rfile.read(length)
   if len(data)!=length or data[:4]!=b'glTF' or struct.unpack_from('<I',data,8)[0]!=length:raise ValueError('Invalid GLB')
   jl=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+jl]);vrm=doc.get('extensions',{}).get('VRMC_vrm',{})
   if vrm.get('specVersion')!='1.0':raise ValueError('Expected VRM 1.0')
   folder=HERE/'work/exports';folder.mkdir(parents=True,exist_ok=True);tmp=tempfile.NamedTemporaryFile(dir=folder,suffix='.vrm.tmp',delete=False);tmp.write(data);tmp.close();os.replace(tmp.name,folder/'Mira-Anatomy.vrm')
   result=json.dumps({'url':'./work/exports/Mira-Anatomy.vrm','bytes':len(data)}).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(result)));self.end_headers();self.wfile.write(result)
  except (ValueError,KeyError,struct.error) as e:self.send_error(400,str(e))
if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',8767),Handler).serve_forever()
