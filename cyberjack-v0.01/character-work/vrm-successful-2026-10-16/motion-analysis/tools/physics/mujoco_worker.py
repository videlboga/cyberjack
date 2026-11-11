"""Headless articulated tracking controller. Root has no actuators or applied forces."""
import sys,json,math,traceback
import numpy as np
import mujoco

def qnorm(q):
    q=np.asarray(q,dtype=float);return q/np.linalg.norm(q)
def conj(q):return np.array([q[0],-q[1],-q[2],-q[3]])
def mul(a,b):
    w,x,y,z=a;v,i,j,k=b
    return np.array([w*v-x*i-y*j-z*k,w*i+x*v+y*k-z*j,w*j-x*k+y*v+z*i,w*k+x*j-y*i+z*v])
def rot(q,v):return mul(mul(q,np.r_[0.,v]),conj(q))[1:]
def quat(q):return qnorm([q[3],q[0],q[1],q[2]])
def text(v):return ' '.join(str(float(x)) for x in v)
def localq(node,frames,index,nodes):
    q=quat(frames[index][node['name']]['q']);p=node['parent']
    return mul(conj(quat(frames[index][p]['q'])),q) if p else q

def build(request):
    nodes={n['name']:n for n in request['nodes']};children={n:[] for n in nodes}
    for n in nodes.values():
        if n['parent']:children[n['parent']].append(n['name'])
    weights={};rest={};hinges={};masses=request.get('mass',55)
    for name,n in nodes.items():
        p=n['parent'];rest[name]=mul(conj(quat(nodes[p]['q'])),quat(n['q'])) if p else quat(n['q'])
        weights[name]=.14 if name=='hips' else .1 if name.startswith('spine') else .07 if name=='head' else .005 if name=='neck' else .1 if name.startswith('thigh') else .055 if name.startswith('leg01') else .02 if name.startswith('arm00') else .016 if name.startswith('forearm') else .012 if name.startswith('foot') else .005
        if name.startswith('leg01') or name.startswith('forearm'):
            rest[name]=localq(n,request['targets'],0,nodes)
            upper=('thigh00_' if name.startswith('leg01') else 'arm00_')+name[-1];end=('foot_' if name.startswith('leg01') else 'hand_')+name[-1]
            bends=[]
            for frame in request['targets']:
                a=np.asarray(frame[upper]['p'])-frame[name]['p'];b=np.asarray(frame[end]['p'])-frame[name]['p'];bends.append(math.pi-math.acos(float(np.clip(a@b/(np.linalg.norm(a)*np.linalg.norm(b)),-1,1))))
            vectors=[]
            for i in range(len(request['targets'])):
                d=mul(conj(rest[name]),localq(n,request['targets'],i,nodes));d=d if d[0]>=0 else -d
                vectors.append(d[1:])
            values=np.asarray(vectors);_,_,vh=np.linalg.svd(values,full_matrices=False);axis=vh[0] if np.linalg.norm(values)>1e-5 else np.array([1.,0,0]);
            if float((values@axis)@(np.asarray(bends)-bends[0]))<0:axis=-axis
            hinges[name]={'axis':axis,'bend':bends[0]}
    total=sum(weights.values());xml=['<mujoco model="cyberjack-humanoid"><compiler angle="radian" inertiafromgeom="true"/><option timestep="0.0041666666667" gravity="0 -9.81 0" integrator="implicitfast" iterations="60" cone="elliptic"/><size njmax="5000" nconmax="1000"/><default><joint damping="8" armature="0.05"/><geom friction="0.8 0.01 0.001" solref="0.012 1" solimp="0.9 0.95 0.001" contype="1" conaffinity="2"/></default><worldbody><geom name="floor" type="plane" size="20 20 .1" quat="0.7071067812 -0.7071067812 0 0" contype="2" conaffinity="1"/>']
    def body(name):
        n=nodes[name];parent=n['parent'];position=rot(conj(quat(nodes[parent]['q'])),np.array(n['p'])-nodes[parent]['p']) if parent else np.array(n['p']);q=rest[name]
        xml.append(f'<body name="{name}" pos="{text(position)}" quat="{text(q)}">')
        if parent:
            if name in hinges:xml.append(f'<joint name="j_{name}" type="hinge" axis="{text(hinges[name]['axis'])}" range="{-hinges[name]['bend']-.04} {(2.88 if name.startswith('leg') else 2.7)-hinges[name]['bend']}" limited="true"/>')
            else:
                limit=.7 if name.startswith('spine') else 1.05 if name in ('head','neck') else 1.25 if name.startswith('foot') else 1.0 if name.startswith('toes') else 2.7
                xml.append(f'<joint name="j_{name}" type="ball" limited="true" range="0 {limit}"/>')
        else:xml.append('<freejoint name="root"/>')
        mass=masses*weights[name]/total;radius=.01 if name.startswith('leg03') else .015 if name.startswith('toes') else .08 if name=='hips' else .075 if name=='head' else .055 if name.startswith('spine') else .04 if name.startswith('thigh') else .028 if name.startswith('leg') else .025 if name.startswith('foot') else .022
        fitted=request.get('colliders',{}).get(name)
        if fitted and fitted.get('type') in ('ellipsoid','box') and len(fitted.get('center',[]))==3 and len(fitted.get('size',[]))==3 and all(.005<=float(x)<=.4 for x in fitted['size']):
            xml.append(f'<geom name="g_{name}" type="{fitted["type"]}" pos="{text(fitted["center"])}" size="{text(fitted["size"])}" mass="{mass}"/>')
        elif name.startswith('foot'):
            reference=quat(request.get('soleReference',{}).get(name,request['targets'][0][name]['q']));center=rot(conj(reference),np.array([0.,-.015,.04]));orientation=conj(reference);xml.append(f'<geom name="g_{name}" type="box" pos="{text(center)}" quat="{text(orientation)}" size=".045 .025 .105" mass="{mass}"/>')
        elif children[name] and name not in ('hips','head'):
            child=children[name][0];end=rot(conj(quat(n['q'])),np.array(nodes[child]['p'])-n['p'])
            if name.startswith('leg01'):end*=.9
            if np.linalg.norm(end)>.025:xml.append(f'<geom name="g_{name}" type="capsule" fromto="0 0 0 {text(end)}" size="{radius}" mass="{mass}"/>')
            else:xml.append(f'<geom name="g_{name}" type="sphere" size="{radius}" mass="{mass}"/>')
        else:xml.append(f'<geom name="g_{name}" type="sphere" size="{radius}" mass="{mass}"/>')
        for child in children[name]:body(child)
        xml.append('</body>')
    body('hips');xml.append('</worldbody></mujoco>');model=mujoco.MjModel.from_xml_string(''.join(xml));return model,nodes,rest,hinges,''.join(xml)

def simulate(request):
    # A loaded bare sole is a contact task. Correct the ankle chain, not an invisible plane.
    for frame in request['targets']:
        for side in ('L','R'):
            name='foot_'+side;fitted=request.get('colliders',{}).get(name)
            if not fitted or fitted.get('type')!='box' or frame[name]['p'][1]>.06:continue
            original=quat(frame[name]['q']);up=rot(original,np.array([0.,1.,0.]))
            if up[1]<.7:continue
            forward=rot(original,np.array([0.,0.,1.]));yaw=math.atan2(forward[0],forward[2]);flat=np.array([math.cos(yaw/2),0.,math.sin(yaw/2),0.]);delta=mul(flat,conj(original))
            for child in ('leg03_'+side,name,'toes_'+side):
                if child in frame:
                    q=mul(delta,quat(frame[child]['q']));frame[child]['q']=q[[1,2,3,0]].tolist()
    model,nodes,rest,hinges,xml=build(request);data=mujoco.MjData(model);names=list(nodes);bodyids={n:mujoco.mj_name2id(model,mujoco.mjtObj.mjOBJ_BODY,n) for n in names};jointids={n:mujoco.mj_name2id(model,mujoco.mjtObj.mjOBJ_JOINT,'j_'+n) for n in names if n!='hips'};hipid=bodyids['hips'];targets=[]
    def encode(frame):
        qpos=np.zeros(model.nq);qpos[:3]=frame['hips']['p'];qpos[3:7]=quat(frame['hips']['q'])
        for name,j in jointids.items():
            d=mul(conj(rest[name]),mul(conj(quat(frame[nodes[name]['parent']]['q'])),quat(frame[name]['q'])));d=d if d[0]>=0 else -d;adr=model.jnt_qposadr[j]
            if name in hinges:qpos[adr]=np.clip(2*math.atan2(float(d[1:]@hinges[name]['axis']),d[0]),model.jnt_range[j][0],model.jnt_range[j][1])
            else:qpos[adr:adr+4]=qnorm(d)
        return qpos
    targets=[encode(frame) for frame in request['targets']]
    initial_frame=request.get('initialPose',request['targets'][0]);data.qpos[:]=encode(initial_frame);mujoco.mj_forward(model,data)
    initial_error=max(float(np.linalg.norm(data.xpos[bid]-initial_frame[name]['p'])) for name,bid in bodyids.items())
    # Calibrate the *collision bodies*, never hair/garments, above the support plane.
    low=0.
    for name,bid in bodyids.items():
        gid=mujoco.mj_name2id(model,mujoco.mjtObj.mjOBJ_GEOM,'g_'+name);center=data.geom_xpos[gid];radius=model.geom_size[gid,0];axis=data.geom_xmat[gid].reshape(3,3)[:,2];half=model.geom_size[gid,1] if model.geom_type[gid]==mujoco.mjtGeom.mjGEOM_CAPSULE else 0;extent=float(np.abs(data.geom_xmat[gid].reshape(3,3)[1])@model.geom_size[gid]) if model.geom_type[gid]==mujoco.mjtGeom.mjGEOM_BOX else float(np.linalg.norm(data.geom_xmat[gid].reshape(3,3)[1]*model.geom_size[gid])) if model.geom_type[gid]==mujoco.mjtGeom.mjGEOM_ELLIPSOID else abs(axis[1])*half+radius;low=min(low,center[1]-extent)
    offset=0. if request.get('initialVelocity') else -low+.003;data.qpos[1]+=offset
    for target in targets:target[1]+=offset
    mujoco.mj_forward(model,data)
    initial=request.get('initialVelocity')
    if initial:
        data.qvel[:6]=np.clip(np.asarray(initial.get('root',[0]*6),dtype=float),-50,50)
        for name,j in jointids.items():
            if name not in initial.get('angular',{}):continue
            child=np.asarray(initial['angular'][name]);parent=np.asarray(initial['angular'].get(nodes[name]['parent'],[0,0,0]));local=rot(conj(data.xquat[bodyids[name]]),child-parent);d=model.jnt_dofadr[j]
            if name in hinges:data.qvel[d]=float(local@hinges[name]['axis'])
            else:data.qvel[d:d+3]=local
        mujoco.mj_forward(model,data)
    duration=request['duration'];n=len(targets);dt=model.opt.timestep;frames=[];support=[];max_penetration=0.;max_root_force=0.;max_torque=0.;saturated=0;dq=np.zeros(model.nv);floorid=mujoco.mj_name2id(model,mujoco.mjtObj.mjOBJ_GEOM,'floor')
    def contacts():
        result=[]
        for ci in range(data.ncon):
            c=data.contact[ci]
            if c.geom1!=floorid and c.geom2!=floorid:continue
            gid=c.geom2 if c.geom1==floorid else c.geom1;bid=model.geom_bodyid[gid];name=mujoco.mj_id2name(model,mujoco.mjtObj.mjOBJ_BODY,bid);f=np.zeros(6);mujoco.mj_contactForce(model,data,ci,f);result.append({'name':name,'point':c.pos.tolist(),'normal':float(max(0,f[0])),'penetration':float(max(0,-c.dist))})
        return result
    def control(target):
        nonlocal max_root_force,max_torque,saturated
        mujoco.mj_differentiatePos(model,dq,1.,data.qpos,target);data.qfrc_applied[:]=0
        if request.get('disableDrives'):return
        for name,j in jointids.items():
            d=model.jnt_dofadr[j];width=1 if name in hinges else 3;leg=name.startswith(('thigh','leg','foot','waist'));kp=300 if leg else 160 if name.startswith('spine') else 65;kd=25 if leg else 16 if name.startswith('spine') else 8;cap=150 if leg else 90 if name.startswith('spine') else 35
            torque=kp*dq[d:d+width]+data.qfrc_bias[d:d+width];saturated+=int(np.any(np.abs(torque)>cap));data.qfrc_applied[d:d+width]=np.clip(torque,-cap,cap)
        planted=[c for c in contacts() if c['name'].startswith(('foot','toes','leg01','hand')) and c['normal']>2]
        if planted:
            support_centers={}
            for c in planted:
                owner='foot_'+c['name'][-1] if c['name'].startswith(('foot','toes')) else c['name']
                if owner.startswith('foot'):support_centers[owner]=data.geom_xpos[mujoco.mj_name2id(model,mujoco.mjtObj.mjOBJ_GEOM,'g_'+owner)].copy()
                else:support_centers[owner]=np.asarray(c['point'])
            center=np.mean(list(support_centers.values()),axis=0);com=data.subtree_com[hipid];error=com-center;vel=data.qvel[:3];balance=np.array([request['mass']*9.81*(error[2]+.18*vel[2]),0.,-request['mass']*9.81*(error[0]+.18*vel[0])]);balance=np.clip(balance,-35,35)*request.get('balanceGain',2.);orientation=mul(target[3:7],conj(data.xquat[hipid]));orientation=orientation if orientation[0]>=0 else -orientation;angle=2*math.acos(float(np.clip(orientation[0],-1,1)));axis=orientation[1:]/max(1e-8,np.linalg.norm(orientation[1:]));angular=rot(data.xquat[hipid],data.qvel[3:6]);balance+=-90*axis*angle+18*angular;balance=np.clip(balance,-85,85)
            total_load=sum(c['normal'] for c in planted)
            loads={}
            for c in planted:
                name=c['name'];name='foot_'+name[-1] if name.startswith('toes') else name;loads[name]=loads.get(name,0.)+c['normal']/max(1.,total_load)
            for name,fraction in loads.items():
                if name.startswith('foot') and 'leg03_'+name[-1] in jointids:name='leg03_'+name[-1]
                if name in jointids:
                    j=jointids[name];d=model.jnt_dofadr[j];local=rot(conj(data.xquat[bodyids[name]]),balance)*fraction
                    if name in hinges:data.qfrc_applied[d]+=float(local@hinges[name]['axis'])
                    else:data.qfrc_applied[d:d+3]+=local
        # No world-space root servo, no invisible support, no gravity cancellation at the root.
        for name,j in jointids.items():
            d=model.jnt_dofadr[j];width=1 if name in hinges else 3;cap=150 if name.startswith(('thigh','leg','foot','waist')) else 90 if name.startswith('spine') else 35;data.qfrc_applied[d:d+width]=np.clip(data.qfrc_applied[d:d+width],-cap,cap)
        data.qfrc_applied[:6]=0;max_root_force=max(max_root_force,float(np.linalg.norm(data.qfrc_applied[:6])));max_torque=max(max_torque,float(np.max(np.abs(data.qfrc_applied))))
    settle=0. if initial else request.get('settle',.2)
    for _ in range(int(settle/dt)):control(targets[0]);mujoco.mj_step(model,data)
    start=data.time
    for i in range(n):
        goal_time=start+duration*i/max(1,n-1)
        while data.time+dt/2<goal_time:
            progress=min(1,(data.time-start)/duration);index=min(n-2,int(progress*(n-1)));fraction=progress*(n-1)-index;target=targets[index].copy();delta=np.zeros(model.nv);mujoco.mj_differentiatePos(model,delta,1.,targets[index],targets[index+1]);mujoco.mj_integratePos(model,target,delta,fraction);control(target);mujoco.mj_step(model,data)
        mujoco.mj_forward(model,data);cs=contacts();max_penetration=max(max_penetration,max((c['penetration'] for c in cs),default=0));frames.append({name:{'p':data.xpos[bid].tolist(),'q':data.xquat[bid][[1,2,3,0]].tolist()} for name,bid in bodyids.items()});support.append({'com':data.subtree_com[hipid].tolist(),'contacts':cs,'rootVelocity':data.qvel[:3].tolist()})
    angular={}
    for name,bid in bodyids.items():
        velocity=np.zeros(6);mujoco.mj_objectVelocity(model,data,mujoco.mjtObj.mjOBJ_BODY,bid,velocity,0);angular[name]=velocity[:3].tolist()
    final_state={'root':data.qvel[:6].tolist(),'angular':angular}
    root_error=float(np.linalg.norm(data.xpos[hipid]-targets[-1][:3]));return {'finalState':final_state,'frames':frames,'support':support,'duration':duration,'metrics':{'engine':'MuJoCo '+mujoco.__version__,'initialRigErrorMeters':initial_error,'massKg':float(np.sum(model.body_mass)),'fittedColliders':request.get('colliders',{}),'maxPenetrationMeters':max_penetration,'rootActuationNewtons':max_root_force,'maxJointTorqueNm':max_torque,'saturatedControls':saturated,'rootTargetErrorMeters':root_error,'calibrationY':offset,'selfCollision':False,'model':'articulated rigid bodies; free root; torque PD joint drives; floor contacts and Coulomb friction'},'xml':xml if request.get('debugXml') else None}

for line in sys.stdin:
    try:
        request=json.loads(line);result=simulate(request);print(json.dumps({'id':request.get('id'),'result':result},allow_nan=False),flush=True)
    except Exception as error:print(json.dumps({'id':request.get('id') if 'request' in locals() else None,'error':str(error),'trace':traceback.format_exc()}),flush=True)
