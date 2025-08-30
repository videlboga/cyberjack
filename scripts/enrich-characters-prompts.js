#!/usr/bin/env node
/**
 * Обогащает карточки персонажей базовыми нарративными промптами и стилем речи.
 * - Вход: data/characters-unified.json
 * - Выход (новая версия): data/characters-unified.v2.json
 * Правила:
 * - Не перезаписывать существующие поля prompt/prompts, только заполнять пропуски
 * - Не включать в промпт упоминание «игры/БДСМ»; описывать персонажа напрямую
 * - Использовать архетип, описание, traits, preferences, fetishes (высокие значения) для тона
 */

const fs = require('fs/promises')
const path = require('path')

async function loadJson(p) {
  const raw = await fs.readFile(p, 'utf8')
  return JSON.parse(raw)
}

function asArray(x) {
  if (!x) return []
  return Array.isArray(x) ? x : [x]
}

function pickTopFetishes(fetishes, limit = 5, min = 0.6) {
  if (!fetishes || typeof fetishes !== 'object') return []
  return Object.entries(fetishes)
    .filter(([, v]) => typeof v === 'number')
    .sort((a, b) => (Number(b[1]) - Number(a[1])))
    .filter(([, v]) => Number(v) >= min)
    .slice(0, limit)
    .map(([k]) => k)
}

function deriveCommunicationStyle(character) {
  const traits = asArray(character.traits).map(String)
  const style = []
  // Простое универсальное правило — без хардкода частных персонажей
  if (traits.some(t => /curious|curiosity|Любопыт/i.test(t))) style.push('любопытный, задаёт вопросы')
  if (traits.some(t => /innocent|добрый|мягкий|gentle/i.test(t))) style.push('мягкий, тёплый тон')
  if (traits.some(t => /artistic|твор/i.test(t))) style.push('образный, метафоричный язык')
  if (traits.some(t => /dominant|домин/i.test(t))) style.push('уверенный, короткие формулировки')
  if (traits.some(t => /submissive|покор/i.test(t))) style.push('осторожный, вежливый, стремится угодить')
  if (traits.some(t => /sarcastic|ирон/i.test(t))) style.push('ироничные замечания, лёгкий сарказм')
  if (style.length === 0) style.push('естественный разговорный стиль')
  return style.join('; ')
}

function buildBasePrompt(character) {
  const name = character.name || 'Персонаж'
  const archetype = character.archetype || ''
  const description = character.description || ''
  const style = character.communicationStyle || deriveCommunicationStyle(character)
  const topFetishes = pickTopFetishes(character.fetishes, 4, 0.7)

  const personaLines = []
  personaLines.push(`Ты — ${name}${archetype ? ` (${archetype})` : ''}.`) // без упоминаний «игра/БДСМ»
  if (description) personaLines.push(description)
  if (style) personaLines.push(`Твой речевой стиль: ${style}.`)
  if (topFetishes.length > 0) personaLines.push(`Сильные отклики: ${topFetishes.join(', ')}.`)

  personaLines.push('Отвечай кратко и естественно, от первого лица, удерживая характер и эмоциональный тон.')
  personaLines.push('Не используй сценические ремарки. Говори на языке входного сообщения.')

  return personaLines.join('\n')
}

function enrichCharacter(ch) {
  const out = { ...ch }
  // Совместимость со старым кодом (CharacterChat/analyzeMessage)
  if (!out.prompt || typeof out.prompt !== 'object') out.prompt = {}
  if (!out.prompt.character) out.prompt.character = buildBasePrompt(out)

  // Совместимо с PromptSystem (prompts.base)
  if (!out.prompts || typeof out.prompts !== 'object') out.prompts = {}
  if (!out.prompts.base) out.prompts.base = out.prompt.character

  // Проставим communicationStyle, если отсутствует
  if (!out.communicationStyle) out.communicationStyle = deriveCommunicationStyle(out)

  return out
}

async function main() {
  const inFile = path.resolve(__dirname, '..', 'data', 'characters-unified.json')
  const outFile = path.resolve(__dirname, '..', 'data', 'characters-unified.v2.json')

  const input = await loadJson(inFile)
  const characters = Array.isArray(input?.characters) ? input.characters : []

  const enriched = characters.map(enrichCharacter)

  const result = { characters: enriched }
  await fs.writeFile(outFile, JSON.stringify(result, null, 2), 'utf8')

  const withPrompts = enriched.filter(c => c?.prompts?.base)
  const filledStyle = enriched.filter(c => !!c?.communicationStyle)
  console.log('✅ Готово: записано', outFile)
  console.log('— Персонажей всего:', characters.length)
  console.log('— С базовым промптом:', withPrompts.length)
  console.log('— С речевым стилем:', filledStyle.length)
}

main().catch(err => {
  console.error('❌ Ошибка обогащения:', err)
  process.exit(1)
})


