// Artistic mappings to native KKBP facial patterns, guided by Mira's portraits.
const p=(eye,brow,mouth,open=.1,eyes=1,pose={})=>({eye,brow,mouth,open,eyes,tears:0,sweat:0,saliva:0,iris:1,eyeWide:0,headPitch:0,headRoll:0,headYaw:0,chestPitch:0,shoulder:0,...pose});
export const PORTRAIT_PROFILES={
 neutral:p('デフォルト','デフォルト','デフォルト',0),
 smile:p('デフォルト','デフォルト','笑顔',.42,1,{headRoll:.06}),
 receptive:p('微笑','デフォルト','笑顔',.28,1,{headRoll:.05}),
 excited:p('デフォルト','驚き','笑顔',.55,1,{headPitch:-.06,shoulder:.05}),
 angry:p('怒り','怒り','怒り',.38,.82,{headPitch:.08,chestPitch:-.07,shoulder:.14}),
 defiant:p('真剣','怒り','怒り',.25,.95,{headPitch:-.08,headYaw:.09,shoulder:.1}),
 fear:p('デフォルト','驚き','驚きs',.18,1,{iris:.58,eyeWide:.28,headPitch:-.04,headRoll:-.1,chestPitch:.12,shoulder:.20}),
 guarded:p('真剣','不安','真剣1',.1,.95,{headYaw:-.12,shoulder:.1}),
 surprise:p('デフォルト','驚き','驚き',.4,1,{iris:.78,headPitch:-.09,headRoll:.1}),
 sad:p('悲しい','困り','寂しい',.12,.8,{headPitch:.13,headRoll:-.1,chestPitch:.08}),
 crying:p('泣き','困り','寂しい',.12,.92,{tears:.8,headPitch:-.19,headRoll:-.06,chestPitch:.11,shoulder:.11}),
 distressed:p('困る','不安','焦り',.35,.95,{headPitch:.09,shoulder:.15}),
 pain:p('苦しい','困り','怒り2',.22,.8,{headPitch:.13,headRoll:.13,chestPitch:.13,shoulder:.17}),
 exhausted:p('つまらない','落胆','デフォルト',.25,.4,{headPitch:.22,headRoll:.15,chestPitch:.15,shoulder:-.08}),
 sleepy:p('つまらない','落胆','デフォルト',.1,.25,{headPitch:.19,headRoll:.12,chestPitch:.1}),
 unconscious:p('両目閉じ','デフォルト','デフォルト',.3,0,{headPitch:.22,headRoll:.18}),
 high_negative:p('デフォルト','不安','焦り',.22,1,{iris:.62,tears:.3,headPitch:.09,chestPitch:.12,shoulder:.20}),
 high_positive:p('照れ','困り','嬉しいs',.28,.78,{headPitch:-.12,headRoll:.08,shoulder:.10}),
 mixed:p('切ない','困り','嬉しい',.3,.8,{headRoll:-.08,shoulder:.08}),
 mixed_overload:p('デフォルト','不安','驚きs',.4,1,{iris:.82,tears:.25,headPitch:-.09,shoulder:.15}),
 pleasure:p('照れ','困り','嬉しいs',.15,.85,{headPitch:-.1,headRoll:.08}),
 aroused:p('デフォルト','困り','嬉しいs',.12,.94,{headPitch:-.06,headRoll:.08}),
 climax:p('両目ぎゅっと閉じ','困り','あ　大',.8,.1,{tongue:.28,headPitch:-.15,shoulder:.16}),
 afterglow:p('微笑','デフォルト','嬉しいs',.2,.55,{headRoll:.14,chestPitch:.06}),
 subspace:p('照れ','困り','嬉しいs',.28,.65,{headPitch:.13,headRoll:.12}),
 shy:p('照れ','困り','嬉しいss',.1,.8,{headPitch:.12,headYaw:.15,shoulder:.11}),
 blush:p('照れ','困り','嬉しいss',.2,.9,{headRoll:.09,shoulder:.08}),
 submissive:p('切ない','困り','デフォルト',.04,.86,{headPitch:.12,shoulder:.08}),
 smug:p('ドヤ','ドヤ','ドヤ',.08,.88,{headPitch:-.11,headRoll:.1}),
 disgust:p('嫌悪','怒り','嫌悪',.25,.7,{headYaw:.15,headPitch:-.07,shoulder:.08}),
 bored:p('つまらない','つまらない','呆れ',.1,.65,{headRoll:.1}),
 curious:p('思案','疑問L','デフォルト',.1,1,{headRoll:.13,headPitch:.04})
};

// Match visible portrait cues rather than assigning fluids to activation alone.
// Only crying has tear trails; overload portraits show small sweat drops.
export const PORTRAIT_EFFECTS={
 fear:{sweat:.25},high_negative:{sweat:.55},mixed_overload:{sweat:.4},
 crying:{tears:1},pain:{sweat:.2},climax:{sweat:.25,saliva:.35},subspace:{saliva:.25}
};
for(const [name,profile]of Object.entries(PORTRAIT_PROFILES)){
 Object.assign(profile,{tears:0,sweat:0,saliva:0},PORTRAIT_EFFECTS[name]);
}
