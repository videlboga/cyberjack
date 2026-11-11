# Pose Mira into SexMachineModel-067 reference pose. v3 — anatomical-chain IK.
#
# Established facts (probed):
#  - Anatomical chain = sequence of bone HEADS: thigh 'Left leg' head=hip, 'Left knee' head=knee,
#    'Left ankle' head=ankle, 'Left toe' head=toes. Bone head->tail axes are control-bone helpers
#    (all point +Z), NOT the anatomical direction.
#  - Pose bone location L produces world delta R_rest @ L (R_rest = bone.matrix_local.to_3x3()).
#  - To aim anatomical segment (head_i -> head_{i+1}) at world dir D: compute current world dir of
#    that segment, get world rotation q, convert to bone-local via conjugation with Rb.
#  - Placing: move head_i to target_i (translate), then rotate bone_i so segment points at target_{i+1}.
#    Rotation happens around the bone head, so head_i stays put.
import bpy, json, math
from mathutils import Vector, Matrix, Quaternion
from pathlib import Path

WORK=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/sex-machine-poses')
OUT=WORK/'out'
TGT=json.loads((OUT/'pose067_blender_targets.json').read_text())

arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.context.view_layer.objects.active=arm
arm.hide_set(False)
bpy.ops.object.mode_set(mode='POSE')
pb={b.name:b for b in arm.pose.bones}
bpy.context.view_layer.update()

report={'ik':{}, 'fk':{}, 'final':{}}

def head_w(n): return arm.matrix_world @ pb[n].head

def move_head_to(name, target):
    b=pb[name]
    bpy.context.view_layer.update()
    delta=Vector(target)-head_w(name)
    R=b.bone.matrix_local.to_3x3()
    b.location += R.inverted() @ delta
    bpy.context.view_layer.update()

def aim_segment(bone_name, next_bone_name, dir_world):
    """Rotate bone so that the anatomical segment head(bone)->head(next_bone)
    aligns with dir_world. Rotation is around the bone's own head."""
    b=pb[bone_name]
    bpy.context.view_layer.update()
    cur=(head_w(next_bone_name)-head_w(bone_name)).normalized()
    d=Vector(dir_world).normalized()
    q_world=cur.rotation_difference(d)
    Rb=b.bone.matrix_local.to_3x3()
    q_local=(Rb.inverted() @ q_world.to_matrix() @ Rb).to_quaternion()
    b.rotation_quaternion = q_local @ b.rotation_quaternion
    bpy.context.view_layer.update()

def place_anatomical_chain(bone_names, targets):
    """bone_names: [root, ..., tip]; targets: world head positions for each bone + final tip point.
    len(targets) == len(bone_names)+1."""
    move_head_to(bone_names[0], targets[0])
    for i in range(len(bone_names)):
        nxt_target=Vector(targets[i+1])
        cur_target=Vector(targets[i])
        if i < len(bone_names)-1:
            aim_segment(bone_names[i], bone_names[i+1], nxt_target-cur_target)
            move_head_to(bone_names[i+1], targets[i+1])
        else:
            # tip bone: aim head->tail at final target
            b=pb[bone_names[i]]
            cur=(arm.matrix_world @ b.tail - head_w(bone_names[i])).normalized()
            d=(nxt_target-cur_target).normalized()
            q_world=cur.rotation_difference(d)
            Rb=b.bone.matrix_local.to_3x3()
            q_local=(Rb.inverted() @ q_world.to_matrix() @ Rb).to_quaternion()
            b.rotation_quaternion = q_local @ b.rotation_quaternion
            bpy.context.view_layer.update()
    res=[round((head_w(n)-Vector(targets[i])).length,4) for i,n in enumerate(bone_names)]
    return res

# ---------- LEGS ----------
for side in ['Left','Right']:
    bones=[f'{side} leg', f'{side} knee', f'{side} ankle', f'{side} toe']
    hip=Vector(TGT['hipL' if side=='Left' else 'hipR'])
    knee=Vector(TGT['kneeL' if side=='Left' else 'kneeR'])
    ankle=Vector(TGT['ankleL' if side=='Left' else 'ankleR'])
    toe=Vector(TGT['toe'])
    res=place_anatomical_chain(bones,[hip,knee,ankle,toe,toe+Vector((0,0.02,0))])
    report['ik'][side]={'residuals':res,'knee':list(head_w(f'{side} knee')),'ankle':list(head_w(f'{side} ankle'))}

# ---------- ARMS ----------
for side,htag in [('Left','handL'),('Right','handR')]:
    bones=[f'{side} shoulder', f'{side} arm', f'{side} elbow', f'{side} wrist']
    sh=Vector(TGT['shoulder']); hand=Vector(TGT[htag])
    sh[0]=0.133 if side=='Left' else -0.133
    elbow=sh+(hand-sh)*0.5 + Vector((0,0,0.05))
    res=place_anatomical_chain(bones,[sh,elbow,hand,hand,hand])
    report['ik'][side+'_arm']={'residuals':res,'hand':list(head_w(f'{side} wrist'))}

# ---------- SPINE + HEAD ----------
hip=Vector(TGT['hip']); chest=Vector(TGT['shoulder']); neck=Vector(TGT['neck']); headtop=Vector(TGT['headtop'])
bones=['Hips','Spine','Chest','Upper Chest','Neck','Head']
spine_mid=hip+(chest-hip)*0.25
uc_mid=chest+(neck-chest)*0.55
targets=[hip, spine_mid, chest, uc_mid, neck, headtop, headtop+Vector((0,0,0.03))]
res=place_anatomical_chain(bones, targets)
# head pitch down ~40 deg
pitch=Matrix.Rotation(math.radians(40),3,'X').to_quaternion()
RbH=pb['Head'].bone.matrix_local.to_3x3()
pb['Head'].rotation_quaternion = ((RbH.inverted() @ pitch.to_matrix() @ RbH).to_quaternion()) @ pb['Head'].rotation_quaternion
bpy.context.view_layer.update()
report['fk']={'residuals':res,'hips':list(head_w('Hips')),'chest':list(head_w('Chest')),'neck':list(head_w('Neck')),'head':list(head_w('Head')),
 'hip_err':round((head_w('Hips')-hip).length,4),'chest_err':round((head_w('Chest')-chest).length,4),
 'neck_err':round((head_w('Neck')-neck).length,4),'head_err':round((head_w('Head')-headtop).length,4)}

# ---------- Floor alignment ----------
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.update()
feet_min=min((arm.matrix_world @ arm.data.bones[n].head).z for n in ['Left ankle','Right ankle','Left toe','Right toe'])
floor=0.042
arm.location.z += floor-feet_min
report['floor']={'before':round(feet_min,4),'floor':floor,'arm_loc':list(arm.location)}
bpy.context.view_layer.update()
def wp(n): return arm.matrix_world @ arm.data.bones[n].head
report['final']={n:list(wp(n)) for n in ['Hips','Left knee','Left ankle','Left toe','Right knee','Right ankle','Left wrist','Right wrist','Head','Neck','Chest']}
report['final']['feet_min_z']=round(min(wp(n).z for n in ['Left ankle','Right ankle','Left toe','Right toe']),4)

(OUT/'pose067_report.json').write_text(json.dumps(report,indent=1,ensure_ascii=False))
print('POSE_DONE', json.dumps(report['final']))
print('RESIDUALS_IK', json.dumps(report['ik']))
print('RESIDUALS_FK', json.dumps(report['fk']))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Mira_pose067.blend'))
print('SAVED_BLEND')
