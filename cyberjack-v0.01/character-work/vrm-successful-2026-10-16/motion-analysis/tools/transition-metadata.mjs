// These trajectories were sampled across the full clip: body orientation, pelvis
// height and the standing endpoint. This is geometric evidence, not a visual style review.
const measured=new Map([
 ['fea07285e041302b4c3761a1',{description:'Опускание из стойки через присед в сидячее положение на полу',entry:'standing',exit:'floor-seated',requiresProp:false}],
 ['a15693258ba0acc7c9650acc',{description:'Подъём с живота',entry:'prone',exit:'standing',requiresProp:false}],
 ['5c067507ed8dca6d85fcd5f9',{description:'Подъём со спины через сидячее положение',entry:'supine',exit:'standing',requiresProp:false}],
 ['ee8d63da9295f419d6582f3d',{description:'Вставание с сиденья; обратный отрезок — посадка',entry:'seat',exit:'standing',requiresProp:true}],
 ['ad99b68840d78ad57cc7c30a',{description:'Опускание на колени',entry:'standing',exit:'kneeling',requiresProp:false}]
]);
export function measuredTransition(id){const row=measured.get(id);return row?{...row,id,neutralTransition:true,neutralLocomotion:false,confidence:.95,secondaryAction:null,origin:'source label plus measured full-clip posture sequence',verifiedGeometry:true,verifiedVisualStyle:false}:null;}

export const measuredTransitionIds=[...measured.keys()];
