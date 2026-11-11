// Neutral upper-body responses. Source poses remain in the Koikatsu bank;
// the additive envelope supplies a short onset and recovery, rather than looping an impact.
export const reactions={
 soft:{label:'Мягкий отклик',clip:'Stand_03_00',emotion:'neutral',duration:1.8,bones:{head:[.07,0,.035],chest:[.025,0,0]}},
 nod:{label:'Кивок',clip:'Stand_00_00',emotion:'neutral',duration:1.5,bones:{head:[.14,0,0],chest:[.025,0,0]}},
 startle:{label:'Вздрагивание',clip:'Stand_17_00',emotion:'surprise',duration:1.6,bones:{chest:[-.1,0,0],head:[-.12,0,.035],leftUpperArm:[0,0,.1],rightUpperArm:[0,0,-.1]}},
 surprise:{label:'Удивление',clip:'Stand_07_00',emotion:'surprise',duration:2.4,bones:{head:[-.09,.06,.05],chest:[-.04,0,0]}},
 joy:{label:'Радость',clip:'Stand_Joy_01',emotion:'smile',duration:2.8,bones:{head:[.04,0,-.07],chest:[-.035,0,.025]}}
};
export function chooseReaction({intensity=.5,sharpness=0,result,emotion}={}){
 if(result==='rejected'||result==='overload')return 'startle';
 if(sharpness>.65||intensity>.8)return 'startle';
 if(['smile','excited','high_positive'].includes(emotion))return 'joy';
 if(['surprise','fear'].includes(emotion))return 'surprise';
 return intensity<.4?'soft':'nod';
}
export function applyReactionLayer(vrm,kind,age,strength=1){
 const profile=reactions[kind];if(!profile||age<0||age>=profile.duration)return 0;
 const t=age/profile.duration,attack=kind==='startle'?.1:.28;
 const envelope=(t<attack?Math.sin(t/attack*Math.PI/2):.5+.5*Math.cos((t-attack)/(1-attack)*Math.PI))*Math.min(1.3,Math.max(.25,strength));
 for(const [name,angles]of Object.entries(profile.bones)){const bone=vrm.humanoid.getRawBoneNode(name);if(bone){bone.rotateX(angles[0]*envelope);bone.rotateY(angles[1]*envelope);bone.rotateZ(angles[2]*envelope)}}
 return envelope;
}
