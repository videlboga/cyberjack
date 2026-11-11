import bpy, json, os, math
from mathutils import Vector, Matrix

BASE = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01"
KIT = BASE + "/public/models/machine-modules/fix-kit"
OUT = BASE + "/public/models/machine-modules/fix-kit/assemblies"
CHK = BASE + "/docs/plans/checks"
os.makedirs(OUT, exist_ok=True); os.makedirs(CHK, exist_ok=True)
G = KIT + '/{}.glb'

def new_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x = 1000; sc.render.resolution_y = 1000
    sc.render.resolution_percentage = 100
    if sc.world is None: sc.world = bpy.data.worlds.new('World')
    sc.world.color = (0.03, 0.03, 0.03)
    return sc

def imp(key):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=G.format(key))
    objs = [o for o in bpy.data.objects if o not in before]
    for o in objs:
        if o.parent is None:
            return o
    return objs[0]

def place(o, loc=(0,0,0), rotz=0, roty=0):
    o.matrix_world = Matrix.Translation(loc) @ Matrix.Rotation(math.radians(rotz),4,'Z') @ Matrix.Rotation(math.radians(roty),4,'Y')
    return o

def bed(sc):
    Z = 0.0736; made = []
    for x,y,d in [(-1,-.5,180),(1,-.5,-90),(1,.5,0),(-1,.5,90)]:
        made.append(place(imp('fix_corner_node'), (x,y,0.0436), d))
    for y in (-.5,.5): made.append(place(imp('fix_rail_2000'), (0,y,Z)))
    for x in (-1,1): made.append(place(imp('fix_cross_1000'), (x,0,Z), 90))
    for x in (-.82,.82):
        for y in (-.5,.5): made.append(place(imp('fix_foot'), (x,y,0)))
    return made

def carriages(long_x=(-.6,.6), cross_y=(-.25,.25), cross_x=-1):
    made = []
    for x in long_x:
        for y in (-.5,.5): made.append(place(imp('fix_carriage'), (x,y,0.0511)))
    for y in cross_y: made.append(place(imp('fix_carriage'), (cross_x,y,0.0511), 90))
    return made

def adapters(kind, positions, z=0.1014, rotz=0):
    return [place(imp(kind), (x,y,z), rotz) for x,y in positions]

def add_env(sc, target=(0,0,.1), loc=(2.6,-3.2,2.2)):
    def light(loc, en, sz):
        bpy.ops.object.light_add(type='AREA', location=loc)
        l=bpy.context.object; l.data.energy=en; l.data.size=sz
        l.rotation_euler=(math.radians(50),0,math.radians(30))
    light((2.5,-3,3.6),1400,4); light((-2.4,-.5,2),600,3); light((.2,2.8,2.4),750,3)
    bpy.ops.mesh.primitive_plane_add(size=10, location=(0,0,-.012))
    g=bpy.context.object; m=bpy.data.materials.new('ground'); m.diffuse_color=(.07,.07,.07,1); g.data.materials.append(m)
    bpy.ops.object.camera_add(location=loc); cam=bpy.context.object; sc.camera=cam; cam.data.lens=50
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    return cam

def render(sc, name, cam):
    sc.render.filepath=OUT+'/'+name+'.png'; bpy.ops.render.render(write_still=True)

# 1. prone: bed, wrists forward, ankles back, two chest/hip pads
sc=new_scene(); objs=bed(sc)+carriages((-.6,.6),(),-1)
objs+=adapters('fix_cuff_adapter', [(-.6,-.5),(-.6,.5),(.6,-.5),(.6,.5)])
objs+=adapters('fix_pad_adapter', [(0,-.28),(0,.28)], z=0.1014)
cam=add_env(sc,(0,0,.12)); render(sc,'prone-3d',cam)
json.dump({'id':'asm_prone_3d','name':'Лёжа на животе — 3D layout','image':'fix-kit/assemblies/prone-3d.png','status':'3D layout pilot','note':'Рама 2×1: 2 рельса, 2 перекладины, 4 узла, 4 опоры, 6 кареток, 4 манжеты, 2 подушки.','modules':4},open(CHK+'/fix-kit-prone-3d.json','w'),ensure_ascii=False,indent=2)

# 2. gyn: bed + backboard + tilt + two foot risers
sc=new_scene(); objs=bed(sc)+carriages((-.5,.5),(),-1)
objs+=adapters('fix_cuff_adapter', [(-.5,-.5),(-.5,.5),(.5,-.5),(.5,.5)])
objs.append(place(imp('fix_pivot'), (-.35,0,0.1014)))
objs.append(place(imp('fix_tilt'), (.72,0,0.1014)))
objs.append(place(imp('fix_backboard'), (.92,0,0.0), 0))
for y in (-.35,.35):
    objs.append(place(imp('fix_riser'), (-.65,y,0.1014)))
    objs.append(place(imp('fix_cuff_adapter'), (-.65,y,0.7014)))
cam=add_env(sc,(0,0,.35),(3.0,-3.2,2.3)); render(sc,'gyn-3d',cam)
json.dump({'id':'asm_gyn_3d','name':'Гинекологическое кресло — 3D layout','image':'fix-kit/assemblies/gyn-3d.png','status':'3D layout pilot','note':'Рама 2×1, спинка-ложе, поворот, наклон и две стойки с манжетами под ноги.','modules':12},open(CHK+'/fix-kit-gyn-3d.json','w'),ensure_ascii=False,indent=2)

# 3. upright: two posts, top rail, boom, pivot, cuff
sc=new_scene()
objs=[]
for y in (-.5,.5):
    objs.append(place(imp('fix_foot'), (0,y,0)))
    objs.append(place(imp('fix_post_1000'), (0,y,0.1014)))
objs.append(place(imp('fix_rail_2000'), (0,0,1.1014), 90))
for y in (-.25,.25):
    objs.append(place(imp('fix_carriage'), (0,y,1.0789), 90))
objs.append(place(imp('fix_boom_500'), (.25,-.5,1.1014)))
objs.append(place(imp('fix_pivot'), (.75,-.5,1.1014)))
objs.append(place(imp('fix_cuff_adapter'), (.75,-.5,1.1914)))
objs.append(place(imp('fix_safety_pin'), (.75,-.5,1.2514)))
cam=add_env(sc,(0,0,.7),(2.8,-3.4,2.5)); render(sc,'upright-3d',cam)
json.dump({'id':'asm_upright_3d','name':'Стоя у стойки — 3D layout','image':'fix-kit/assemblies/upright-3d.png','status':'3D layout pilot','note':'Две стойки 1000, верхний рельс 2000, каретки, консоль 500, поворот и манжета.','modules':9},open(CHK+'/fix-kit-upright-3d.json','w'),ensure_ascii=False,indent=2)

print('RENDERED prone gyn upright')
