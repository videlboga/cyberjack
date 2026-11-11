import bpy, json, math
from mathutils import Vector
from pathlib import Path
OUT=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/sex-machine-poses/reports')
OUT.mkdir(exist_ok=True)
scn=bpy.context.scene
# engine: try EEVEE, fallback CYCLES
try:
    scn.render.engine='BLENDER_EEVEE_NEXT'
    print('ENGINE EEVEE')
except Exception as e:
    scn.render.engine='CYCLES'
    print('ENGINE CYCLES fallback', e)
if scn.render.engine=='CYCLES':
    scn.cycles.samples=16
    scn.cycles.device='CPU'
scn.render.resolution_x=900; scn.render.resolution_y=1100
scn.render.resolution_percentage=100
scn.render.film_transparent=False
# find bounds of meshes to frame
xs=[];ys=[];zs=[]
for o in bpy.data.objects:
    if o.type=='MESH':
        for v in o.bound_box:
            w=o.matrix_world @ Vector(v)
            xs.append(w.x);ys.append(w.y);zs.append(w.z)
cx=(min(xs)+max(xs))/2; cy=(min(ys)+max(ys))/2; cz=(min(zs)+max(zs))/2
sx=max(xs)-min(xs); sy=max(ys)-min(ys); sz=max(zs)-min(zs)
print('BOUNDS', min(xs),max(xs),min(ys),max(ys),min(zs),max(zs))
# remove default lights/cubes
for o in list(bpy.data.objects):
    if o.type in ('LIGHT','CAMERA','MESH') and o.name in ('Light','Camera','Cube'):
        bpy.data.objects.remove(o)
# sun
sun=bpy.data.objects.new('sun', bpy.data.lights.new('sun','AREA'))
sun.data.energy=3.0; sun.data.size=2
sun.location=(2,2,4); sun.rotation_euler=(math.radians(50),math.radians(10),math.radians(30))
bpy.context.scene.collection.objects.link(sun)
fill=bpy.data.objects.new('fill', bpy.data.lights.new('fill','AREA'))
fill.data.energy=1.2; fill.data.size=2
fill.location=(-2,-1,2); fill.rotation_euler=(math.radians(60),0,math.radians(-120))
bpy.context.scene.collection.objects.link(fill)
# cameras: side view (figure faces +Y, so side = camera on +X axis)
cam_data=bpy.data.cameras.new('cam')
cam_data.lens=50
def make_cam(name, loc, target):
    c=bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(c)
    c.location=loc
    d=Vector(target)-Vector(loc)
    c.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
    return c
c1=make_cam('cam_side',(cx+max(sx,sz)*1.3+0.5, cy, cz+0.1),(cx,cy,cz))
c2=make_cam('cam_front',(cx, cy-max(sy,sz)*1.3-0.5, cz+0.1),(cx,cy,cz))
c3=make_cam('cam_34',(cx+max(sx,sz)*0.9, cy-max(sy,sz)*0.9, cz+max(sx,sz)*0.5),(cx,cy,cz))
for cam,name in [(c1,'side'),(c2,'front'),(c3,'threequarter')]:
    scn.camera=cam
    scn.render.filepath=str(OUT/f'mira_pose067_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', name)
print('DONE')
