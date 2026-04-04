import fs from 'node:fs';
import path from 'node:path';
import { TAG_LIBRARY } from '../src/orchestration/characterGenerator/tagDefinitions';
import { LEVEL_ORDER, LoreLevel } from '../src/orchestration/characterGenerator/types';
import { buildLoreNotes } from '../src/orchestration/characterGenerator/loreSource';

const usageMap: Record<LoreLevel, string> = {
  world: 'Используется как фоновый лор: summary/keywords идут в блок [Записки из лора], помогают SillyTavernу держать сеттинг.',
  faction: 'Даёт фракционный контекст для [Записок из лора]; ключевые слова подсказывают связи с корпорациями.',
  origin: 'Формирует происхождение персонажа: summary/personaHooks попадают в [Характер и повадки], narrative.* строят блок Identity/History.',
  event: 'Определяет важные события прошлого — подмешиваются в [Характер и повадки] и биографию.',
  trait: 'Черты характера/поведения для блока [Характер и повадки]; помогают задать актуальное поведение.'
};

function csvEscape(value: string): string {
  if (value === undefined || value === null) return '';
  const str = value.replace(/\r?\n/g, ' ').replace(/"/g, '""');
  if (/[",\n;]/.test(str)) {
    return `"${str}"`;
  }
  return str;
}

const headers = [
  'level',
  'id',
  'title',
  'summary',
  'weight',
  'requires',
  'excludes',
  'stKeywords',
  'personaHooks',
  'narrative_identity',
  'narrative_history',
  'narrative_activation',
  'loreRefs',
  'loreNotes',
  'usage'
];

const rows: string[] = [];
rows.push(headers.join(','));

for (const level of LEVEL_ORDER) {
  for (const tag of TAG_LIBRARY[level]) {
    const loreNotes = tag.loreRefs?.length
      ? buildLoreNotes(tag.loreRefs).map((note) => `${note.uid}: ${note.text.replace(/\s+/g, ' ')}`)
      : [];
    const row = [
      level,
      tag.id,
      tag.title || tag.id,
      tag.summary || '',
      tag.weight?.toString() || '',
      (tag.requires || []).join(' | '),
      (tag.excludes || []).join(' | '),
      (tag.stKeywords || []).join(' | '),
      (tag.personaHooks || []).join(' | '),
      tag.narrative?.identity?.join(' | ') || '',
      tag.narrative?.history?.join(' | ') || '',
      tag.narrative?.activation?.join(' | ') || '',
      (tag.loreRefs || []).join(' | '),
      loreNotes.join(' || '),
      usageMap[level] || ''
    ].map(csvEscape).join(',');
    rows.push(row);
  }
}

const outPath = path.resolve(process.cwd(), 'tag_catalog.csv');
fs.writeFileSync(outPath, rows.join('\n'), 'utf-8');
console.log(`CSV saved to ${outPath}`);
