// Пилот разметки клипов VLM: контактный лист → два независимых прогона → согласие.
//
// Модель видит только картинки и минимальные факты (длительность, fps, число кадров).
// Измеренная геометрия в промпт НЕ попадает — иначе проверка превращается в подсказку.
//
// Запуск:
//   node tools/vlm-annotate.mjs --clips ../external-library/clips/100style.json \
//        --out ../data/clip-semantics-pilot.jsonl --limit 20

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const puppeteer = require('/home/cyberkitty/.npm/_npx/e65ceaa76006e709/node_modules/puppeteer-core');

const MODEL = process.env.VLM_MODEL || 'gemma4:31b';
const API = 'https://ollama.com/api/chat';
const PAGE = 'http://127.0.0.1:8799/motion-analysis/qa-pilot-sheets.html';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : d;
};

const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, 'motion-analysis/data/clip-taxonomy.json'), 'utf8'));
const ACTION_IDS = Object.keys(taxonomy.actions);
const ACTION_IDS_H = [...ACTION_IDS, ...Object.keys(taxonomy.actionsH || {})];

function prompt(clip, passIndex, mode) {
  return `Ты размечаешь кадры 3D-анимации для игрового движка. На листе ${passIndex === 0 ? 'пять' : 'пять других'} кадров ОДНОГО клипа, подряд по времени. Два ряда: ВЕРХНИЙ — вид спереди, НИЖНИЙ — вид сбоку; кадры одного момента стоят друг под другом. Модель — базовая, без одежды, поэтому крой одежды не учитывай: оценивай ТОЛЬКО позу и движение.

Известно: длительность ${clip.duration.toFixed(2)} с, ${clip.fps} fps.

${mode === 'h' ? 'Это H-сцена Koikatsu: отрендерен ОДИН персонаж (партнёр в кадре отсутствует). Поэтому о партнёре не суди — описывай только позу персонажа и то, что она делает сама.\n' : ''}
Сначала опиши ТОЛЬКО то, что видно в кадрах, в блоке "cues", и уже из него выведи действие.
Не ставь класс по общему впечатлению.

Верни строго JSON без пояснений:
{
 "cues": {
   "support": "feet|one_foot|both_knees|one_knee|hips|back|hands|none",
   "arms": "down|raised|outstretched|swinging|repeated_rhythm|one_raised",
   "torso": "upright|bent_forward|bent_back|twisted|still",
   "legs": "stance|stride|together|split|tucked|one_leg_up",
   "repetition": "none|two_or_more_cycles",
   "travel": "in_place|small_shift|travels",
   "airborne": "none|brief_both_feet|one_foot"
 },
 "action": {"id": "<одно из: ${(mode === 'h' ? ACTION_IDS_H : ACTION_IDS).join(', ')}>", "confidence": 0.0},
 "posture": {"value": "standing|seated|kneeling|crouching|lying|suspended", "confidence": 0.0},
 "roles": {"actor": "single|pair|group", "dominance": "neutral|dominant|submissive", "initiative": "self|partner|shared|unknown"},
 "contacts": ["foot-floor|knee-floor|hip-floor|back-floor|hand-floor|hand-body|restraint-prop|none"],
 "affect": {"valence": -2..2, "arousal": -2..2, "control": -2..2},
 "intensity": 0.0..1.0,
 "exposure": {"regions": ["chest|hips|thighs|neck|none"]},
 "restraint": {"present": true|false, "kind": "rope|chains|cuffs|armbinder|collar|leash|cage|stocks|harness|none"},
 "phases": [{"id": "start|loop|insert|hold|out|stop|transition", "start": 0.0, "end": 1.0}],
 "alt": {"id": "<второй по вероятности класс или null>"},
 "notes": "до 200 символов по-русски",
 "uncertain": ["что не удалось определить"],
 "evidenceFrames": [номера кадров]
}

Правила выбора класса по признакам (нарушение = ошибка):
- "dance" ТОЛЬКО при repetition="two_or_more_cycles" И (arms="repeated_rhythm" ИЛИ torso="twisted"). Нет повторов — танец не ставится.
- "stretch" ТОЛЬКО при arms="raised" И torso="bent_back" (потягивание с прогибом). Если прогиба нет — ставь stand, turn или walk.
- "wave" ТОЛЬКО при arms="one_raised" и почти неподвижном корпусе (torso="upright", travel="in_place"); иначе ставь stretch или stand.
- "pick_up" ТОЛЬКО если виден наклон вниз и рука у пола хотя бы в одном кадре; если все кадры выпрямлены — ставь stand или stand_up.
- "sit" при support="hips" и согнутых бёдрах; "crouch" при support="feet" и глубоко согнутых коленях; "kneel" при support="both_knees" или "one_knee"; "lie" при support="back" и горизонтальном корпусе.
- "jump" ТОЛЬКО если в кадрах есть отрыв обеих стоп от пола хотя бы в одном кадре.
Только id из списка; если действие непонятно — "unknown" и добавь поле в uncertain; числа целые для affect, шаг 0.1 для intensity и confidence.`;
}

async function callVlm(imageDataUrl, text) {
  const b64 = imageDataUrl.split(',')[1];
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OLLAMA_API_KEY2}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{role: 'user', content: text, images: [b64]}],
      stream: false,
      format: 'json',
      options: {temperature: 0.2},
    }),
  });
  if (!res.ok) throw new Error(`VLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const raw = (data.message && data.message.content) || '';
  const m = raw.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}


// Класс выводится из наблюдаемых признаков детерминированно, а не «на глазок».
// Порядок важен: сначала опоры и отрыв от пола, затем руки, затем перемещение.
function classifyCues(c) {
  if (!c) return null;
  const rep = c.repetition === 'two_or_more_cycles';
  if (c.support === 'back') return 'lie';
  if (c.support === 'hips') return 'sit';
  if (c.support === 'both_knees' || c.support === 'one_knee') return 'kneel';
  if (c.support === 'hands') return c.legs === 'stride' ? 'crawl' : 'crouch';
  if (c.airborne === 'brief_both_feet') return 'jump';
  if (rep && (c.arms === 'repeated_rhythm' || c.torso === 'twisted')) return 'dance';
  if (c.arms === 'one_raised' && c.torso === 'upright') return 'wave';
  if (c.arms === 'raised' && c.torso === 'bent_back') return 'stretch';
  if (c.torso === 'bent_forward' && (c.arms === 'down' || c.arms === 'swinging')) return 'pick_up';
  if (c.legs === 'one_leg_up') return 'stand';
  if (c.travel === 'travels' && c.support === 'feet') return 'walk';
  if (c.support === 'feet' && c.torso === 'upright') return 'stand';
  return 'unknown';
}

function agreement(a, b) {
  if (!a || !b) return {score: 0, notes: ['нет валидного JSON в одном из прогонов']};
  const same = [];
  same.push(a.action?.id === b.action?.id);
  same.push(Math.abs((a.intensity ?? 0) - (b.intensity ?? 0)) <= 0.2);
  const aff = ['valence', 'arousal', 'control'].every(k =>
    Math.abs((a.affect?.[k] ?? 0) - (b.affect?.[k] ?? 0)) <= 1);
  same.push(aff);
  same.push(!!a.restraint?.present === !!b.restraint?.present);
  const score = same.filter(Boolean).length / same.length;
  const notes = [];
  if (!same[0]) notes.push(`действие: ${a.action?.id} vs ${b.action?.id}`);
  if (!same[1]) notes.push(`интенсивность: ${a.intensity} vs ${b.intensity}`);
  if (!same[2]) notes.push('аффект расходится больше чем на 1');
  if (!same[3]) notes.push('фиксация: да/нет расходятся');
  return {score, notes};
}

async function main() {
  const clipsPath = arg('--clips', path.join(ROOT, 'motion-analysis/external-library/clips/100style.json'));
  const outPath = arg('--out', path.join(ROOT, 'motion-analysis/data/clip-semantics-pilot.jsonl'));
  const limit = Number(arg('--limit', 20));
  const sheetDir = path.join(ROOT, 'motion-analysis/data/pilot-sheets');
  fs.mkdirSync(sheetDir, {recursive: true});

  const doc = JSON.parse(fs.readFileSync(clipsPath, 'utf8'));
  const mode = arg('--mode', 'style');
  const views = arg('--views', 'single');
  let clips = [];
  if (mode === 'custom') {
    clips = doc.clips.slice();
  } else if (mode === 'h') {
    clips = doc.clips.slice();
  } else if (mode === 'cmu') {
    // Не походки: статические классы, где смысл виден в кадре (поза), а не в темпе
    const wanted = ['sit on high stool', 'stand up', 'crouch', 'kneel', 'lie', 'pick up', 'wave', 'dance'];
    for (const kw of wanted) {
      const forKw = doc.clips.filter(c => (c.name || '').toLowerCase().includes(kw)
        && !/walk|run/i.test(c.name));
      clips.push(...forKw.slice(0, 2));
    }
  } else {
    const wanted = ['Star', 'Aeroplane', 'ArmsAboveHead', 'WideLegs', 'Old', 'Crouched', 'ArmsFolded', 'ArmsBySide'];
    for (const style of wanted) {
      const forStyle = doc.clips.filter(c => c.name.includes(`${style} `) || c.name.includes(`${style}·`));
      clips.push(...forStyle.slice(0, 3));
    }
  }
  clips = clips.slice(0, limit);
  console.log(`клипов в пилоте: ${clips.length}`);

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await page.setViewport({width: 1300, height: 1300});
  await page.goto(PAGE, {waitUntil: 'domcontentloaded', timeout: 90000});
  await page.waitForFunction('window.__sheets && window.__sheets.ready', {timeout: 180000});
  const bones = await page.evaluate(() => window.__sheets.bones);
  console.log('костей на VRM:', bones);

  const out = fs.createWriteStream(outPath);
  const rows = [];
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const d = clip.duration;
    // плотнее по времени: 9 кадров на прогон, второй прогон смещён — поза «в середине» не теряется
    const passes = [
      [0.04, 0.16, 0.28, 0.40, 0.52, 0.64, 0.76, 0.88, 0.97].map(f => f * d),
      [0.10, 0.22, 0.34, 0.46, 0.58, 0.70, 0.82, 0.94, 0.99].map(f => f * d),
    ];
    const answers = [];
    const timings = [];
    for (let p = 0; p < 2; p++) {
      const url = await page.evaluate((c, times, vw) => window.__sheets.renderClip(c, times, 'full', vw), clip, passes[p], views);
      const sheetPath = path.join(sheetDir, `${clip.id}-pass${p + 1}.png`);
      fs.writeFileSync(sheetPath, Buffer.from(url.split(',')[1], 'base64'));
      const t0 = Date.now();
      try {
        const ans = await callVlm(url, prompt(clip, p, arg('--mode', 'style')));
        answers.push(ans);
        timings.push(Date.now() - t0);
      } catch (err) {
        console.error('  VLM ошибка:', clip.id, err.message);
        answers.push(null);
      }
    }
    const agree = agreement(answers[0], answers[1]);
    const rec = {
      schema: 'clip-semantics/1',
      clipId: clip.id,
      name: clip.name,
      model: MODEL,
      passes: answers,
      agreement: agree,
      actionDerived: (answers[0] && answers[0].cues) ? classifyCues(answers[0].cues) : null,
      evidence: agree.score === 1 ? 'vlm-2pass-strong' : (agree.score >= 0.5 ? 'vlm-2pass-soft' : 'needs-review'),
      latencyMs: timings.length ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : null,
    };
    rows.push(rec);
    out.write(JSON.stringify(rec) + '\n');
    console.log(`  ${i + 1}/${clips.length} ${clip.id}: ${answers[0]?.action?.id ?? '—'} / ${answers[1]?.action?.id ?? '—'} (согласие ${agree.score.toFixed(2)})`);
  }
  out.end();
  await browser.close();
  const strong = rows.filter(r => r.agreement.score === 1).length;
  const soft = rows.filter(r => r.agreement.score >= 0.5 && r.agreement.score < 1).length;
  const dist = {};
  for (const r of rows) {
    const id = (r.passes[0] && r.passes[0].action && r.passes[0].action.id) || 'none';
    dist[id] = (dist[id] || 0) + 1;
  }
  const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0] || ['none', 0];
  const share = rows.length ? top[1] / rows.length : 0;
  console.log(`\nготово: ${rows.length} клипов · полное согласие ${strong} · частичное ${soft} · на ревью ${rows.length - strong - soft}`);
  if (share > 0.3) console.log(`ВНИМАНИЕ: класс-магнит «${top[0]}» — ${top[1]} из ${rows.length} (${Math.round(share * 100)}%).`);
  console.log('файл:', outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
