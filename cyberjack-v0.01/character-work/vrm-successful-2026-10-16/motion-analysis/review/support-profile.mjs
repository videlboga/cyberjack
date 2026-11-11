// Conservative geometric hypothesis: a horizontal pair of thighs and bent knees
// under an upright torso implies an external seat, not balance on two feet.
export function supportProfile(f){
 const seated=f.inclination<55&&f.hipHeight>.25&&f.hipHeight<.65&&Math.min(f.leftKnee,f.rightKnee)>45&&Math.min(f.leftForward,f.rightForward)>55&&Math.max(f.leftForward,f.rightForward)<120;
 return {kind:seated?'seat-assumed':'feet-or-other',assumed:seated,anchor:seated?'pelvis':'low-endpoints',label:seated?'Предполагается сиденье: опора таза, ноги свободны':'Опоры по низким конечностям'};
}
