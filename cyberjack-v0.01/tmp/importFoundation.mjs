import fs from 'node:fs';
import path from 'node:path';

const srcPath = path.resolve('docs', 'omnicron_character_generator_foundation.md');
const raw = fs.readFileSync(srcPath, 'utf-8');
const codeBlockRegex = /```json([\s\S]*?)```/g;
const tagCandidates = [];
const loreCandidates = [];
let match;
while ((match = codeBlockRegex.exec(raw)) !== null) {
  const block = match[1].trim();
  if (!block) continue;
  let parsed;
  try {
    parsed = JSON.parse(block);
  } catch (error) {
    console.warn('Failed to parse block:', error.message);
    continue;
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (item.id) {
      tagCandidates.push(item);
    } else if (item.uid) {
      loreCandidates.push(item);
    }
  }
}

const ensureArray = value => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const arr = value.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
    return arr.length ? arr : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : undefined;
  }
  return undefined;
};

const convertTag = tag => {
  const narrative = tag.narrative || {};
  const text = typeof tag.text === 'string' ? tag.text.trim() : '';
  const converted = {
    id: tag.id,
    level: tag.level,
    title: tag.title || tag.name || text || tag.id,
    summary: tag.summary || text || '',
    stKeywords: ensureArray(tag.stKeywords || tag.keys) || [],
    loreRefs: ensureArray(tag.loreRefs) || [],
    weight: typeof tag.weight === 'number' ? tag.weight : undefined,
    requires: ensureArray(tag.requires),
    excludes: ensureArray(tag.excludes),
    personaHooks: ensureArray(tag.personaHooks),
    narrative: undefined
  };

  if (text) {
    converted.personaHooks = converted.personaHooks?.length ? converted.personaHooks : [text];
  }

  const narrativeConverted = {
    identity: ensureArray(narrative.identity) || (text ? [text] : undefined),
    history: ensureArray(narrative.history),
    activation: ensureArray(narrative.activation)
  };
  if (narrativeConverted.identity || narrativeConverted.history || narrativeConverted.activation) {
    converted.narrative = narrativeConverted;
  }

  return converted;
};

const convertLore = entry => {
  const comment = entry.comment || entry.title || entry.uid;
  const content = entry.content || comment || '';
  return {
    uid: entry.uid,
    comment,
    content,
    keys: entry.keys || [],
    enabled: true,
    insertion_order: entry.insertion_order ?? 500,
    position: entry.position || 'before_char'
  };
};

const tags = tagCandidates.map(convertTag);
const lore = loreCandidates.map(convertLore);

const tagsPath = path.resolve('lore', 'tags', 'foundation.json');
fs.writeFileSync(tagsPath, JSON.stringify({ tags }, null, 2), 'utf-8');

const lorePath = path.resolve('lore', 'FoundationLore.json');
fs.writeFileSync(lorePath, JSON.stringify({ entries: lore }, null, 2), 'utf-8');

console.log(`Converted ${tags.length} tags and ${lore.length} lore entries.`);
