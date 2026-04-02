import fs from 'node:fs';
import path from 'node:path';

const sourcePath = '/home/cyberkitty/Загрузки/Qwen_json_20260402_3vqztw8jg.json';
const outputPath = path.resolve('lore', 'tags', 'world_factions.json');

const raw = fs.readFileSync(sourcePath, 'utf-8');
const parsed = JSON.parse(raw);
const entries = Array.isArray(parsed.entries) ? parsed.entries : [];

const prefixLevelMap = [
  { key: 'фракция', level: 'faction' },
  { key: 'мир', level: 'world' },
  { key: 'метаправило', level: 'world' },
  { key: 'система', level: 'world' },
  { key: 'аномалия', level: 'world' }
];

const tags = [];
for (const entry of entries) {
  const comment = (entry.comment || '').toLowerCase();
  const mapping = prefixLevelMap.find(m => comment.startsWith(m.key));
  if (!mapping) continue;

  const tag = {
    id: entry.uid,
    level: mapping.level,
    title: entry.comment || entry.uid,
    summary: entry.content || '',
    stKeywords: Array.isArray(entry.keys) ? entry.keys : [],
    loreRefs: entry.uid ? [entry.uid] : [],
    personaHooks: entry.content ? [entry.content] : undefined,
    narrative: entry.content
      ? {
          identity: [entry.content]
        }
      : undefined
  };
  tags.push(tag);
}

fs.writeFileSync(outputPath, JSON.stringify({ tags }, null, 2), 'utf-8');
console.log(`Generated ${tags.length} world/faction tags to ${outputPath}`);
