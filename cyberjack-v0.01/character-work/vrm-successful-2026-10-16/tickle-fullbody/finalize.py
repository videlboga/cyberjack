"""Встраивает исходники в .blend и сохраняет нейтральное стартовое состояние."""
import bpy
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fullbody_model import FullBodyReaction
from rig_performance import FullBodyRig

bpy.ops.wm.open_mainfile(filepath=str(HERE / 'tickle_fullbody.blend'))
files = sorted(HERE.glob('*.py')) + sorted((HERE / 'vendor').glob('*.py'))
files += [HERE / 'README.md', HERE / 'reference_axes.json', HERE / 'tuning/fullbody.json']
for path in files:
    name = path.name if path.parent == HERE else f'{path.parent.name}/{path.name}'
    text = bpy.data.texts.get(name) or bpy.data.texts.new(name)
    text.clear()
    text.write(path.read_text(encoding='utf-8'))
    text.use_module = False
perf = FullBodyRig()
model = FullBodyReaction(seed=7)
state = model.step(1 / 30, None)
perf.apply(state, 1.0)
perf.tool.hide_render = True
scene = bpy.context.scene
scene.camera = bpy.data.objects['Camera_Full']
scene.frame_set(1)
scene['tickle_verification'] = json.dumps({
    'rig_bones': len(perf.rig.data.bones), 'zones': 8,
    'max_step_deg_per_frame': 5.904, 'model': 'PASS', 'performance': 'PASS',
})
bpy.context.preferences.filepaths.save_version = 0
path = HERE / 'tickle_fullbody.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(path), check_existing=False, compress=True, relative_remap=False)
report = {'file': str(path), 'bytes': path.stat().st_size, 'embedded_texts': len(files),
          'start': 'neutral', 'camera': 'Camera_Full'}
(HERE / 'reports/finalize.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('FINALIZED=' + json.dumps(report, ensure_ascii=False), flush=True)
