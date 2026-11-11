import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent));import bvh_metrics as B
from export_pilot_clips import build_clip,S100
base=Path(__file__).resolve().parents[2];source='/tmp/rigtest/style100/100STYLE/Neutral/Neutral_TR1.bvh';clips=[]
for label,start,end in [('a',3502,3583),('b',2098,2197)]:
 prep=B.parse(source,window=(start,end-start+6));fps=1/prep[2];n=round((end-start)/fps*30)+1
 c=build_clip(str(base.parent/'animations/source_rigs.json'),source,S100,0,n,fps,{'id':'neutral-turn-'+label,'label':'Neutral recorded turn '+label,'source':'100STYLE/Neutral/Neutral_TR1.bvh','provenance':{'dataset':'100STYLE','license':'CC BY 4.0','attribution':'Mason I. et al., 100STYLE (2022)','sourceFrames':[start,end],'fpsSource':fps,'processing':'recorded turn rotations; root translation omitted for in-place pilot'}},preparsed=prep);c['duration']=c['tracks'][0]['times'][-1];clips.append(c)
(base/'data/external-neutral-turn-source.json').write_text(json.dumps({'clips':clips}));print([(c['id'],c['duration']) for c in clips])
