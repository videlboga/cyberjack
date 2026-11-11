// Shared world-space mesh input. Retain native topology; offset each mesh once.
export function mergeRibbonSurfaces(parts){
 const positions=new Float32Array(parts.reduce((sum,p)=>sum+p.positions.length,0));
 const indices=new Uint32Array(parts.reduce((sum,p)=>sum+p.indices.length,0));
 let vertexOffset=0,indexOffset=0;
 for(const part of parts){positions.set(part.positions,vertexOffset*3);for(let i=0;i<part.indices.length;i++)indices[indexOffset+i]=part.indices[i]+vertexOffset;vertexOffset+=part.positions.length/3;indexOffset+=part.indices.length;}
 return {positions,indices,matrix:null};
}
