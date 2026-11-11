import {prepareHairCollider as prepare,projectHairCollider as project} from './hair-capsule-collider.js?v=worker-3';
export function prepareHairCollider(shape){return shape.surface?shape:prepare(shape);}
export function projectHairCollider(point,shape,padding=.006){return shape.surface?shape.surface.projectParticle(point,padding,{},true):project(point,shape,padding);}
