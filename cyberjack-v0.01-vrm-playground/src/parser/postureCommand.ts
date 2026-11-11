// Deliberately narrow: a single affirmative imperative, addressed to the active
// character. Questions, negation, quotations and compound requests go to the LLM.
export function parsePostureCommand(text:string){
 const line=text.toLocaleLowerCase('ru-RU').trim().replace(/[.!]$/,'').replace(/^пожалуйста[, ]+|[, ]+пожалуйста$/g,'').trim();
 const leg=/^(?:я хочу на тебя полюбоваться[.!]\s*)?вытяни (левую|правую) (?:ножку|ногу)(?: впер[её]д)?$/.exec(line);
 if(leg)return 'posture_leg_'+(leg[1]==='левую'?'left':'right')+'_forward';
 const rules:Array<[RegExp,string]>=[
 [/^(сядь|присядь)$/,'pose_sitting'],[/^(встань|стой прямо)$/,'pose_standing'],[/^ляг(?: на спину)?$/,'pose_lying_down'],
 [/^(подними|поднять) (?:обе )?руки(?: вверх)?$/,'posture_arms_up'],[/^опусти (?:обе )?руки$/,'posture_arms_down'],
 [/^разведи (?:обе )?руки(?: в стороны)?$/,'posture_arms_sides'],[/^(вытяни|выстави) (?:обе )?руки (?:перед собой|вперёд|вперед)$/,'posture_arms_front'],
 [/^поверни голову (налево|влево)$/,'posture_head_left'],[/^поверни голову (направо|вправо)$/,'posture_head_right'],[/^смотри прямо$/,'posture_head_forward'],
 ];
 return rules.find(([pattern])=>pattern.test(line))?.[1]||null;
}
