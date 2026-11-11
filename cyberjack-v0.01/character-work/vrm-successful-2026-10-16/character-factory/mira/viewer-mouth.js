// A rest-surface lip patch. Parameter t runs from the mouth seam to the outer
// vermilion border; the seam and surrounding skin stay fixed. Expression offsets are transported
// from this rebuilt rest surface, rather than reclassified after the mouth opens.
export function sculptMouth(point,amount=0){
 amount=Math.max(0,Math.min(1,amount));if(!amount)return Array.from(point);
 const [x,y,z]=point,u=x/.018;if(Math.abs(u)>=1||z<=.058)return Array.from(point);
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const span=Math.sqrt(1-u*u),seam=1.4355+.00035*u*u,dy=y-seam;
 const height=(dy>=0?.0038:.0048)*span,t=Math.abs(dy)/height;
 const distance=Math.abs(dy),falloff=.022*span;
 if(distance>=falloff)return Array.from(point);
 // Expand the full lip band, then reconnect it to the surrounding skin with
 // a monotone transition. Bulging only its middle leaves the old thin rim.
 const expansion=(dy>=0?.0035:.0045)*span;
 const stretch=distance<=height?Math.sin(Math.PI*t/2):1-smooth((distance-height)/(falloff-height));
 const front=smooth((z-.058)/.005),profile=t<1?Math.sin(Math.PI*t)**2:0,weight=amount*span*profile*front;
 const bow=Math.exp(-Math.pow((Math.abs(x)-.004)/.003,2))-.4*Math.exp(-Math.pow(x/.0025,2));
 return [x,y+Math.sign(dy)*amount*expansion*stretch*front+(dy>=0?weight*.00025*bow:0),z+weight*(dy>=0?.0003:.0004)];
}
