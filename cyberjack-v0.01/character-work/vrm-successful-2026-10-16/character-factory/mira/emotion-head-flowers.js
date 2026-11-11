import * as THREE from 'three';
// Small modelled blossoms, attached to the same sculpt cage as the face.
// The flower plane faces +Z in the canonical Y-up head coordinates.
export function flowerPetalGeometry(radius,angle){
 const positions=[],colors=[],indices=[],rows=14,columns=8;
 const cream=new THREE.Color('#fff9eb'),ivory=new THREE.Color('#f3dcad');
 for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
  const t=i/rows,u=j/columns*2-1;
  const length=radius*(.08+.92*t),width=radius*.52*Math.sin(Math.PI*t)**.72;
  const x=length*Math.cos(angle)-u*width*Math.sin(angle),y=length*Math.sin(angle)+u*width*Math.cos(angle);
  const z=radius*(-.13+.24*t*t+.12*u*u*Math.sin(Math.PI*t));
  positions.push(x,y,z);const c=ivory.clone().lerp(cream,Math.min(1,t*3));colors.push(c.r,c.g,c.b);
  if(i<rows&&j<columns){const a=i*(columns+1)+j,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export class HeadFlowers{
 constructor(head){this.head=head;this.group=null;this.key='';this.socket=null;}
 update(flowers){
  const h=this.head,key=JSON.stringify([h.faceEditor?.key,flowers]);if(this.key===key&&this.socket===h.socketMesh)return;
  this.clear();this.key=key;this.socket=h.socketMesh;if(!flowers?.length||!h.socketMesh)return;
  const group=this.group=new THREE.Group();group.name='Портрет · цветы в волосах';h.socketMesh.add(group);
  const petals=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.68,side:THREE.DoubleSide});
  const gold=new THREE.MeshStandardMaterial({color:'#dca43c',roughness:.52});
  const pollen=new THREE.MeshStandardMaterial({color:'#f5c760',roughness:.62});
  const sphere=new THREE.SphereGeometry(1,10,7);
  for(const config of flowers){
   const bloom=new THREE.Group();bloom.position.fromArray(h.faceEditor?.cage?.sample(config.position)||config.position);bloom.rotation.set(...(config.rotation||[0,0,0]));group.add(bloom);
   for(let k=0;k<5;k++)bloom.add(new THREE.Mesh(flowerPetalGeometry(config.radius,k*Math.PI*2/5),petals));
   const center=new THREE.Mesh(sphere,gold);center.scale.set(config.radius*.21,config.radius*.21,config.radius*.13);bloom.add(center);
   for(let k=0;k<9;k++){
    const a=k*2.399,r=config.radius*(.06+.2*Math.sqrt(k/8));
    const bead=new THREE.Mesh(sphere,pollen);bead.scale.setScalar(config.radius*.064);bead.position.set(Math.cos(a)*r,Math.sin(a)*r,config.radius*(.13+.07*Math.sin(k*1.7)));bloom.add(bead);
   }
  }
 }
 clear(){if(!this.group)return;this.group.removeFromParent();const geometry=new Set(),materials=new Set();this.group.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of [].concat(o.material||[]))materials.add(m);});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.group=null;}
 dispose(){this.clear();this.socket=null;this.key='';}
}
