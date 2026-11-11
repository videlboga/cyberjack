import * as T from './vendor/three/three.module.js';
// Project against a posed capsule (or a legacy sphere). Shared by chain and
// render-ring constraints so interpolation cannot cut through the torso.
const preparedColliders=new WeakMap();
export function prepareHairCollider(shape){
 const a=shape.center||shape.a,axis=shape.b?.clone().sub(shape.a),axisLength=axis?.lengthSq()||0,n=shape.depthAxis?.clone().normalize(),scale=shape.depthScale||1;
 const fallback=axisLength>1e-12?new T.Vector3().crossVectors(axis,Math.abs(axis.y/Math.sqrt(axisLength))<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0)).normalize():new T.Vector3(1,0,0);
 preparedColliders.set(shape,{x:a.x,y:a.y,z:a.z,ax:axis?.x||0,ay:axis?.y||0,az:axis?.z||0,invAxis:axisLength>1e-12?1/axisLength:0,nx:n?.x||0,ny:n?.y||0,nz:n?.z||0,depth:Boolean(n),scale,invScale:1/scale,radius:shape.radius,capScale:shape.capScale||1,ux:axisLength?axis.x/Math.sqrt(axisLength):0,uy:axisLength?axis.y/Math.sqrt(axisLength):0,uz:axisLength?axis.z/Math.sqrt(axisLength):1,fx:fallback.x,fy:fallback.y,fz:fallback.z});
 return shape;
}
function projectPrepared(point,s,padding){
 const t=s.invAxis?Math.max(0,Math.min(1,((point.x-s.x)*s.ax+(point.y-s.y)*s.ay+(point.z-s.z)*s.az)*s.invAxis)):0;
 const cx=s.x+s.ax*t,cy=s.y+s.ay*t,cz=s.z+s.az*t;
 let x=point.x-cx,y=point.y-cy,z=point.z-cz;
 if(s.capScale!==1){const d=(x*s.ux+y*s.uy+z*s.uz)*(1/s.capScale-1);x+=s.ux*d;y+=s.uy*d;z+=s.uz*d;}
 if(s.depth){const d=(x*s.nx+y*s.ny+z*s.nz)*(s.invScale-1);x+=s.nx*d;y+=s.ny*d;z+=s.nz*d;}
 const radius=s.radius+padding*(s.depth?s.invScale:1),lengthSq=x*x+y*y+z*z;
 if(lengthSq>=radius*radius)return false;
 if(lengthSq>1e-18){const k=radius/Math.sqrt(lengthSq);x*=k;y*=k;z*=k;}else{x=s.fx*radius;y=s.fy*radius;z=s.fz*radius;}
 if(s.depth){const d=(x*s.nx+y*s.ny+z*s.nz)*(s.scale-1);x+=s.nx*d;y+=s.ny*d;z+=s.nz*d;}
 if(s.capScale!==1){const d=(x*s.ux+y*s.uy+z*s.uz)*(s.capScale-1);x+=s.ux*d;y+=s.uy*d;z+=s.uz*d;}
 point.set(cx+x,cy+y,cz+z);return true;
}
export function projectHairCollider(point,shape,padding=.002){
 if(shape.capScale&&shape.capScale!==1&&!preparedColliders.has(shape))prepareHairCollider(shape);
 const prepared=preparedColliders.get(shape);if(prepared)return projectPrepared(point,prepared,padding);
 let cx=shape.center?.x??shape.a.x,cy=shape.center?.y??shape.a.y,cz=shape.center?.z??shape.a.z;
 const ax=shape.b?shape.b.x-shape.a.x:0,ay=shape.b?shape.b.y-shape.a.y:0,az=shape.b?shape.b.z-shape.a.z:0,axisLength=ax*ax+ay*ay+az*az;
 if(shape.b&&axisLength>1e-12){const t=Math.max(0,Math.min(1,((point.x-cx)*ax+(point.y-cy)*ay+(point.z-cz)*az)/axisLength));cx+=ax*t;cy+=ay*t;cz+=az*t;}
 let x=point.x-cx,y=point.y-cy,z=point.z-cz,nx=shape.depthAxis?.x||0,ny=shape.depthAxis?.y||0,nz=shape.depthAxis?.z||0;
 const scale=shape.depthScale||1,nLength=Math.sqrt(nx*nx+ny*ny+nz*nz);if(nLength){nx/=nLength;ny/=nLength;nz/=nLength;const d=(x*nx+y*ny+z*nz)*(1/scale-1);x+=nx*d;y+=ny*d;z+=nz*d;}
 const radius=shape.radius+padding/(shape.depthAxis?scale:1),length=Math.sqrt(x*x+y*y+z*z);if(length>=radius)return false;
 if(length>1e-9){const k=radius/length;x*=k;y*=k;z*=k;}else if(shape.b&&axisLength>1e-12){
  if(Math.abs(ay/Math.sqrt(axisLength))<.9){x=-az;y=0;z=ax;}else{x=0;y=az;z=-ay;}
  const k=radius/Math.sqrt(x*x+y*y+z*z);x*=k;y*=k;z*=k;
 }else{x=radius;y=0;z=0;}
 if(shape.depthAxis){const d=(x*nx+y*ny+z*nz)*(scale-1);x+=nx*d;y+=ny*d;z+=nz*d;}
 point.set(cx+x,cy+y,cz+z);return true;
}
