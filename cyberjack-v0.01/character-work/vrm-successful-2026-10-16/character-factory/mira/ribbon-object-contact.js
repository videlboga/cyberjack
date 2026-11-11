// Static furniture uses coherent box faces instead of competing triangle faces.
export function projectRibbonObject(point,previous,box,cache,margin=.006){
 const lo=box.min,hi=box.max;
 if(point.x<lo[0]-margin||point.x>hi[0]+margin||point.y<lo[1]-margin||point.y>hi[1]+margin||point.z<lo[2]-margin||point.z>hi[2]+margin){
  let enter=0,exit=1,face=-1;for(let axis=0;axis<3;axis++){const key=['x','y','z'][axis],origin=previous[key],d=point[key]-origin;if(Math.abs(d)<1e-12){if(origin<lo[axis]-margin||origin>hi[axis]+margin){cache.face=-1;return false;}continue;}let a=(lo[axis]-margin-origin)/d,b=(hi[axis]+margin-origin)/d,side=axis*2;if(a>b){[a,b]=[b,a];side++;}if(a>enter){enter=a;face=side;}exit=Math.min(exit,b);if(enter>exit){cache.face=-1;return false;}}
  if(face<0||enter>1){cache.face=-1;return false;}const axis=face>>1,key=['x','y','z'][axis],target=face%2?hi[axis]+margin:lo[axis]-margin,delta=target-point[key];point[key]=target;previous[key]+=delta;previous[key]=point[key];cache.face=face;return true;
 }
 const distances=[point.x-lo[0]+margin,hi[0]+margin-point.x,point.y-lo[1]+margin,hi[1]+margin-point.y,point.z-lo[2]+margin,hi[2]+margin-point.z];
 let face=distances.indexOf(Math.min(...distances));
 // Keep the contact side through edge ties, rather than alternate each step.
 if(cache.face>=0&&distances[cache.face]<distances[face]+.012)face=cache.face;
 for(let axis=0;axis<3;axis++){const key=['x','y','z'][axis];if(previous[key]<lo[axis]-margin){face=axis*2;break;}if(previous[key]>hi[axis]+margin){face=axis*2+1;break;}}
 cache.face=face;const axis=face>>1,key=['x','y','z'][axis],sign=face%2?1:-1,target=sign>0?hi[axis]+margin:lo[axis]-margin,correction=target-point[key];
 if(Math.abs(correction)<.0002)return false;
 point[key]=target;previous[key]+=correction;const velocity=(point[key]-previous[key])*sign;if(velocity<0)previous[key]=point[key];return true;
}

