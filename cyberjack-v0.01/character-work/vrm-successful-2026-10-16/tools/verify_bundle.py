#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,os,sys
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'SHA256SUMS.json').read_text());failed=[];cache={}
for name,target in manifest.get('symlinks',{}).items():
 p=root/name
 if not p.is_symlink() or os.readlink(p)!=target:failed.append({'file':name,'error':'symlink'})
for name,spec in manifest['files'].items():
 p=root/name
 if not p.is_file():failed.append({'file':name,'error':'missing'});continue
 st=p.stat();key=(st.st_dev,st.st_ino,st.st_size,st.st_mtime_ns)
 if key not in cache:
  h=hashlib.sha256()
  with p.open('rb') as f:
   for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
  cache[key]=h.hexdigest()
 if st.st_size!=spec['bytes'] or cache[key]!=spec['sha256']:failed.append({'file':name,'error':'checksum'})
print(json.dumps({'files_checked':len(manifest['files']),'failures':failed},indent=2));sys.exit(bool(failed))
