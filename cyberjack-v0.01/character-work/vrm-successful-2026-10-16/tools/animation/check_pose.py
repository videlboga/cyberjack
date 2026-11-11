import json,numpy as np
from scipy.spatial.transform import Rotation as R
from pathlib import Path
O=Path(__file__).parent;d=json.load(open(O/'koikatsu-idles.json'));rig={b['name']:b for b in d['sourceRig']}
selected=['cf_j_hips','cf_j_head','cf_j_arm00_L','cf_j_forearm01_L','cf_j_hand_L','cf_j_arm00_R','cf_j_forearm01_R','cf_j_hand_R','cf_j_leg03_L','cf_j_leg03_R']
result={}
for clip in [None]+[c for c in d['clips'] if c['id'] in ['Idle_00_00','Stand_00_00']]:
 tracks={t['bone']:t for t in clip['tracks']} if clip else {};cache={}
 def calc(n):
  if n in cache:return cache[n]
  b=rig[n];r=R.from_quat(tracks[n]['rotations'][:4] if n in tracks else b['rotation']);p=np.array(b['position']);sc=np.array(b['scale'])
  if b['parent']:
   pp,pr,ps=calc(b['parent']);p=pp+pr.apply(p*ps);r=pr*r;sc=ps*sc
  cache[n]=(p,r,sc);return cache[n]
 result[clip['id'] if clip else 'rest']={n:calc(n)[0].round(6).tolist() for n in selected}
 # all coordinates for plotting
 result[(clip['id'] if clip else 'rest')+'_all']={n:calc(n)[0].tolist() for n in rig}
print(json.dumps({k:v for k,v in result.items() if not k.endswith('_all')},indent=2));(O/'pose_world_check.json').write_text(json.dumps(result,indent=2))
