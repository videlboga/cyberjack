import json,struct,io
from pathlib import Path
from PIL import Image
import numpy as np
OUT=Path('/home/cyberkitty/Documents/Codex/2026-10-15/x20/outputs/mira_four_outfits')
SRC=Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/Export_PMX/20261016013030_KamiwataKrista')
p=OUT/'Mira_outfit_02.vrm';blob=p.read_bytes();jl=struct.unpack_from('<I',blob,12)[0];d=json.loads(blob[20:20+jl]);start=20+jl;blen=struct.unpack_from('<I',blob,start)[0];binary=bytearray(blob[start+8:start+8+blen]);mat=next(m for m in d['materials'] if m['name']=='KK cf_m_body');mask=Image.open(SRC/'cf_m_body_AM_02.png').convert('RGBA');report=[]
for label,tex in [('light',mat['pbrMetallicRoughness']['baseColorTexture']),('dark',mat['extensions']['VRMC_materials_mtoon']['shadeMultiplyTexture'])]:
 imspec=d['images'][d['textures'][tex['index']]['source']];bv=d['bufferViews'][imspec['bufferView']];im=Image.open(io.BytesIO(binary[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']])).convert('RGBA');px=np.array(im);a=np.array(mask.resize(im.size,Image.Resampling.LANCZOS),dtype=np.float32)/255;px[:,:,3]=(px[:,:,3].astype(np.float32)*a[:,:,0]).astype('uint8');out=Image.fromarray(px);png=io.BytesIO();out.save(png,format='PNG');data=png.getvalue();file=OUT/'textures'/f'mira_body_outfit02_{label}_outermask.png';file.write_bytes(data)
 binary+=b'\0'*((-len(binary))%4);imspec['bufferView']=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data)});binary+=data;report.append({'image':label,'alpha_mask':'R outer mask × G inner mask × original texture alpha','file':str(file)})
binary+=b'\0'*((-len(binary))%4);d['buffers'][0]['byteLength']=len(binary);j=json.dumps(d,ensure_ascii=False,separators=(',',':')).encode();j+=b' '*((-len(j))%4);p.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(j)+len(binary))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\0')+binary);(OUT/'body_mask_audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('OUTER_MASK_RESTORED')
