// Blend skeletal shapes around the pelvis, not the exporter root far from the body.
export function stabilizeTransitionRoot(t,pose,from,to,weight){const a=t.point(from,'hips'),b=t.point(to,'hips'),now=t.point(pose,'hips');pose[0].p.x+=a.x+(b.x-a.x)*weight-now.x;pose[0].p.z+=a.z+(b.z-a.z)*weight-now.z;t.m.fk(pose);return pose;}
