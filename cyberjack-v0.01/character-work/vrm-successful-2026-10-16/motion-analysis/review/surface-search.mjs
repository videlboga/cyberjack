// Exact nearest neighbour for a frozen, deformed skin cloud. Rebuild when the
// body pose changes; preserve original sample order for equal-distance ties.
export function createSurfaceSearch(cloud){const axes=['x','y','z'];
 const build=(indices,depth)=>{if(!indices.length)return null;const axis=axes[depth%3];indices.sort((a,b)=>cloud[a].position[axis]-cloud[b].position[axis]||a-b);const mid=indices.length>>1;return{i:indices[mid],axis,left:build(indices.slice(0,mid),depth+1),right:build(indices.slice(mid+1),depth+1)};};
 const root=build(cloud.map((_,i)=>i),0);
 return point=>{let best=null,distance=.18**2,index=Infinity;const visit=node=>{if(!node)return;const sample=cloud[node.i],d=sample.position.distanceToSquared(point);if(d<distance||d===distance&&node.i<index){best=sample;distance=d;index=node.i;}const delta=point[node.axis]-sample.position[node.axis],first=delta<0?node.left:node.right,second=delta<0?node.right:node.left;visit(first);if(delta*delta<=distance)visit(second);};visit(root);return {sample:best,distance};};
}
