import { parseVerbalInputWithLLM } from '../src/adapters/llmAdapter';
import { getModelAssignment } from '../src/adapters/modelAssignments';

const a = getModelAssignment('parser');
console.log('parser providers:', a.providers, 'models:', a.models);

const sys = `Разбери одно сообщение игрока. Физическое действие самого игрока здесь невозможно: оно приходит только кнопкой. Звёздочки не означают действие.

Исполняемой командой считаются только явно сформулированная просьба/приказ, чтобы персонаж:
1) сделал действие сам;
2) сделал действие с другим присутствующим персонажем;
3) сменил позу;
4) переместился;
5) начал, изменил или прекратил текущий процесс.
Обсуждение, вопрос, желание игрока и упоминание действия командой не являются.

Ближайшие действия: act_slap=Пощечина; act_kiss=Поцелуй
Ближайшие точки тела: neck=Шея; lips=Губы
Доступные позы: pose_standing=Стойка
Присутствующие: S-AV-01=Мира
Контекст места: Лаборатория
Верни JSON: {speechType, command:{type}}`;

try {
  const r = await parseVerbalInputWithLLM([{role:'system',content:sys},{role:'user',content:'Привет, Мира. Как ты себя чувствуешь?'}], {type:'json_object'}, 'parser');
  console.log('PARSED OK:', JSON.stringify(r.parsed));
} catch (e: any) {
  console.log('ERROR:', e.message);
}
