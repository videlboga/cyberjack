"""Быстрая проверка ручной правки: рендер текущей сцены + сравнение с 2D и 3D референсами.

Запуск:
  blender -b <scene.blend> --python check.py
или
  blender -b --python check.py -- <scene.blend> <префикс>

Результат: <префикс>-front.png, <префикс>-side.png, compare-<префикс>.png
"""
import bpy, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SCENE = args[0] if args else "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16/character-factory/mira/mira-v3.blend"
TAG = args[1] if len(args) > 1 else "check"
OUT = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16/character-factory/mira"
REF2D = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/character-images/rendered/mira/tpose__nude__none__neutral.png"
REF3D = os.path.join(OUT, "tripo-front.png")

bpy.ops.wm.open_mainfile(filepath=SCENE)
body = bpy.data.objects["Foot shape-1"]
face = bpy.data.objects.get("Face")

sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "SINGLE"
sc.display.shading.single_color = (0.82, 0.8, 0.78)
sc.render.film_transparent = True
sc.render.resolution_x = 900
sc.render.resolution_y = 1200

for o in bpy.data.objects:
    if o.type == "MESH":
        o.hide_render = o.name not in ("Foot shape-1", "Face")
body.hide_render = False
if face:
    face.hide_render = False

dg = bpy.context.evaluated_depsgraph_get()
pts = []
for ob in (body, face):
    if not ob:
        continue
    ev = ob.evaluated_get(dg)
    m = ev.to_mesh()
    pts += [(ob.matrix_world @ v.co)[:] for v in m.vertices]
    ev.to_mesh_clear()
co = np.array(pts)
zmin, zmax = co[:, 2].min(), co[:, 2].max()
H = zmax - zmin
cx = (co[:, 0].max() + co[:, 0].min()) / 2
print(f"рост {H*100:.1f} см")

cd = bpy.data.cameras.new("Cchk")
cam = bpy.data.objects.new("Cchk", cd)
sc.collection.objects.link(cam)
cd.type = "ORTHO"
cd.ortho_scale = H * 1.10
sc.camera = cam
cz = zmin + H / 2
for name, (loc, rot) in {
    "front": ((cx, -4, cz), (math.radians(90), 0, 0)),
    "side": ((cx + 4, 0, cz), (math.radians(90), 0, math.radians(90))),
}.items():
    cam.location = loc
    cam.rotation_euler = rot
    sc.render.filepath = os.path.join(OUT, f"{TAG}-{name}.png")
    bpy.ops.render.render(write_still=True)


def trim(im):
    a = np.asarray(im)
    m = a[:, :, 3] > 40 if a[:, :, 3].min() < 250 else (a[:, :, :3].astype(int).mean(axis=2) < 245)
    ys, xs = np.where(m)
    return im.crop((xs.min() - 10, ys.min() - 10, xs.max() + 10, ys.max() + 10))


panels = [trim(Image.open(REF2D).convert("RGBA")), trim(Image.open(REF3D).convert("RGBA")),
          trim(Image.open(os.path.join(OUT, f"{TAG}-front.png")).convert("RGBA"))]
h = 1050
panels = [p.resize((int(p.width * h / p.height), h), Image.LANCZOS) for p in panels]
out = Image.new("RGBA", (sum(p.width for p in panels) + 40, h + 40), (18, 20, 26, 255))
x = 0
d = ImageDraw.Draw(out)
try:
    f = ImageFont.truetype("/usr/share/fonts/TTF/DejaVuSans.ttf", 22)
except Exception:
    f = None
for p, lab in zip(panels, ["2D-реф", "3D-реф (Tripo)", f"сборка: {TAG}"]):
    out.alpha_composite(p, (x, 40))
    d.text((x + 4, 10), lab, fill=(190, 225, 255, 255), font=f)
    x += p.width + 20
out.convert("RGB").save(os.path.join(OUT, f"compare-{TAG}.png"))
print("готово:", os.path.join(OUT, f"compare-{TAG}.png"))
