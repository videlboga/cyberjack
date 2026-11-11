import * as THREE from 'three';
// A closed solid ribbon: two fabric faces joined by narrow edge faces.
export function solidRibbon(sample,rows=48,cols=10,thickness=.00065){
 const p=[],ix=[];
 for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++)p.push(...sample(i/rows,j/cols*2-1));
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+cols+1;ix.push(a,b,a+1,a+1,b,b+1);}
 const base=new THREE.BufferGeometry();base.setAttribute('position',new THREE.Float32BufferAttribute(p,3));base.setIndex(ix);base.computeVertexNormals();
 const n=base.attributes.normal,count=p.length/3,out=[];
 for(const side of [-1,1])for(let i=0;i<count;i++)out.push(p[i*3]+side*n.getX(i)*thickness/2,p[i*3+1]+side*n.getY(i)*thickness/2,p[i*3+2]+side*n.getZ(i)*thickness/2);
 const indices=[];for(let k=0;k<ix.length;k+=3){indices.push(ix[k]+count,ix[k+1]+count,ix[k+2]+count,ix[k+2],ix[k+1],ix[k]);}
 const edge=(a,b)=>indices.push(a,b,b+count,a,b+count,a+count);
 for(let i=0;i<rows;i++){edge(i*(cols+1),(i+1)*(cols+1));edge((i+1)*(cols+1)+cols,i*(cols+1)+cols);}
 for(let j=0;j<cols;j++){edge(j+1,j);edge(rows*(cols+1)+j,rows*(cols+1)+j+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));g.setIndex(indices);g.computeVertexNormals();base.dispose();return g;
}
