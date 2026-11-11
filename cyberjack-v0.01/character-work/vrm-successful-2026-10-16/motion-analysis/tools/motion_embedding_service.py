"""Local multilingual E5 retrieval. Query and corpus never leave this process."""
import os,json,hashlib,sys
from pathlib import Path
os.environ['TOKENIZERS_PARALLELISM']='false'
import numpy as np
import torch
from transformers import AutoTokenizer,AutoModel
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
base=Path(__file__).resolve().parents[1]
model_name='intfloat/multilingual-e5-small'
torch.set_num_threads(4)
tokenizer=AutoTokenizer.from_pretrained(model_name)
model=AutoModel.from_pretrained(model_name,use_safetensors=True).eval()
def encode(texts,prefix):
    result=[]
    for start in range(0,len(texts),48):
        batch=tokenizer([prefix+t for t in texts[start:start+48]],padding=True,truncation=True,max_length=160,return_tensors='pt')
        with torch.inference_mode():
            output=model(**batch).last_hidden_state
            mask=batch['attention_mask'][...,None]
            pooled=(output*mask).sum(1)/mask.sum(1)
            pooled=torch.nn.functional.normalize(pooled,p=2,dim=1)
        result.append(pooled.cpu().numpy())
        if len(texts)>48 and start%480==0: print('Embedded',start,'/',len(texts),flush=True)
    return np.concatenate(result)
raw=(base/'data/motion-semantic-corpus.json').read_bytes();corpus=json.loads(raw)['rows']
signature=hashlib.sha256(raw).hexdigest();cache=base/'data/motion-semantic-e5.npz'
if cache.exists() and str(np.load(cache)['signature'])==signature:
    vectors=np.load(cache)['vectors'];print('Loaded index',len(corpus),flush=True)
else:
    unique=list(dict.fromkeys(r['text'] for r in corpus));lookup={s:i for i,s in enumerate(unique)}
    encoded=encode(unique,'passage: ');vectors=encoded[[lookup[r['text']] for r in corpus]]
    np.savez_compressed(cache,vectors=vectors,signature=signature)
    print('Saved index',len(corpus),'unique',len(unique),flush=True)
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body=json.dumps({'ready':True,'model':model_name,'clips':len(corpus),'signature':signature}).encode();self.send_response(200);self.end_headers();self.wfile.write(body)
    def do_POST(self):
        try:
            length=int(self.headers.get('Content-Length','0'))
            if length>8192: raise ValueError('Request too large')
            data=json.loads(self.rfile.read(length));query=data['query']
            if not isinstance(query,str) or not query.strip() or len(query)>1500:raise ValueError('Invalid query')
            scores=vectors@encode([query],'query: ')[0];n=min(200,max(1,int(data.get('limit',40))))
            indices=np.argsort(-scores,kind='stable')[:n]
            body=json.dumps({'model':model_name,'signature':signature,'matches':[{**corpus[i],'score':float(scores[i])}for i in indices]},ensure_ascii=False).encode()
            self.send_response(200);self.end_headers();self.wfile.write(body)
        except Exception as e:
            self.send_response(400);self.end_headers();self.wfile.write(json.dumps({'error':str(e)}).encode())
    def log_message(self,*args):pass
print('Semantic search ready on 127.0.0.1:8790',flush=True)
ThreadingHTTPServer(('127.0.0.1',8790),Handler).serve_forever()
