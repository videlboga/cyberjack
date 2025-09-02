/*
  Универсальная миграция данных к единому system-конфигу.
  - Читает data/system-unified.json
  - Создаёт версии:
    - data/characters-unified.v2.json
    - data/poses-unified.v2.json
  Принципы:
  - Без частных кейсов. Только совпадение по id из конфига.
  - Существующие значения сохраняются; новые ключи заполняются дефолтами.
*/

const fs = require('fs')
const path = require('path')

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8')
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

function migrateCharacters(system) {
  const srcPath = path.join(process.cwd(), 'data', 'characters-unified.json')
  if (!fs.existsSync(srcPath)) {
    console.log('characters-unified.json not found, skipping')
    return
  }
  const dstPath = path.join(process.cwd(), 'data', 'characters-unified.v2.json')
  const data = readJson(srcPath)

  const attrDefs = Array.isArray(system.attributes) ? system.attributes : []
  const extraAttrDefs = Array.isArray(system.attributes_extra) ? system.attributes_extra : []
  const stateDefs = Array.isArray(system.states) ? system.states : []
  const fetishDefs = Array.isArray(system.fetishes) ? system.fetishes : []

  const attrIds = new Set([...attrDefs.map(a => a.id), ...extraAttrDefs.map(a => a.id)])
  const stateIds = new Set(stateDefs.map(s => s.id))
  const fetishIds = new Set(fetishDefs.map(f => f.id))

  // Строим маппинг анатомия -> sensitivity_* автоматически по id
  const sensitivityMap = {}
  for (const a of extraAttrDefs) {
    if (typeof a.id === 'string' && a.id.startsWith('sensitivity_')) {
      const key = a.id.slice('sensitivity_'.length)
      sensitivityMap[key] = a.id
    }
  }
  // Универсальные алиасы (без частных кейсов на значения):
  // Анатомия может быть шире, чем sensitivity_*; добавим безопасные соответствия
  const aliases = { vulva: 'clitoris' }

  const migrated = { ...data }
  migrated.characters = (data.characters || []).map((ch) => {
    const srcAttributes = ch.attributes || {}
    const srcCondition = ch.condition || {}
    const srcFetishes = ch.fetishes || {}
    const srcAnatomy = Array.isArray(ch.anatomy) ? ch.anatomy : []

    const newAttributes = {}
    for (const id of attrIds) {
      const val = srcAttributes[id]
      newAttributes[id] = typeof val === 'number' ? val : 0
    }

    // Автозаполнение чувствительности по анатомии (если пусто)
    for (const part of srcAnatomy) {
      const normalized = String(part || '').trim()
      const key = aliases[normalized] || normalized
      const sensId = sensitivityMap[key]
      if (sensId && Object.prototype.hasOwnProperty.call(newAttributes, sensId)) {
        if (!newAttributes[sensId] || newAttributes[sensId] === 0) {
          newAttributes[sensId] = 5 // базовое среднее значение
        }
      }
    }

    const newCondition = {}
    for (const id of stateIds) {
      const val = srcCondition[id]
      newCondition[id] = typeof val === 'number' ? val : 0
    }

    const newFetishes = {}
    for (const id of fetishIds) {
      const val = srcFetishes[id]
      newFetishes[id] = typeof val === 'number' ? val : 0
    }

    return {
      ...ch,
      attributes: newAttributes,
      condition: newCondition,
      fetishes: newFetishes,
      anatomy: srcAnatomy
    }
  })

  writeJson(dstPath, migrated)
  console.log(`✔ characters migrated -> ${path.relative(process.cwd(), dstPath)}`)
}

function migratePoses(system) {
  const srcPath = path.join(process.cwd(), 'data', 'poses-unified.json')
  if (!fs.existsSync(srcPath)) {
    console.log('poses-unified.json not found, skipping')
    return
  }
  const dstPath = path.join(process.cwd(), 'data', 'poses-unified.v2.json')
  const data = readJson(srcPath)

  const migrated = JSON.parse(JSON.stringify(data))
  const anatomyList = Array.isArray(system.anatomy) ? system.anatomy : []
  const extraAttrDefs = Array.isArray(system.attributes_extra) ? system.attributes_extra : []
  const sensitivityMap = {}
  for (const a of extraAttrDefs) {
    if (typeof a.id === 'string' && a.id.startsWith('sensitivity_')) {
      const key = a.id.slice('sensitivity_'.length)
      sensitivityMap[key] = a.id
    }
  }
  const aliases = { vulva: 'clitoris' }

  if (migrated.poses && typeof migrated.poses === 'object') {
    for (const poseKey of Object.keys(migrated.poses)) {
      const pose = migrated.poses[poseKey]
      for (const angle of (pose.angles || [])) {
        angle.activeZones = (angle.activeZones || []).map(z => {
          // Без частных маппингов — просто добавляем поле, если его нет.
          if (z.anatomyId && !anatomyList.includes(z.anatomyId)) {
            // недопустимое значение — очищаем
            return { ...z, anatomyId: undefined }
          }
          let sensitivityAttribute
          if (z.anatomyId) {
            const key = aliases[z.anatomyId] || z.anatomyId
            sensitivityAttribute = sensitivityMap[key]
          }
          return { anatomyId: z.anatomyId, sensitivityAttribute, ...z }
        })
      }
    }
  }

  writeJson(dstPath, migrated)
  console.log(`✔ poses migrated -> ${path.relative(process.cwd(), dstPath)}`)
}

function main() {
  const systemPath = path.join(process.cwd(), 'data', 'system-unified.json')
  if (!fs.existsSync(systemPath)) {
    console.error('system-unified.json not found')
    process.exit(1)
  }
  const system = readJson(systemPath)

  migrateCharacters(system)
  migratePoses(system)
}

try {
  main()
  console.log('✅ Migration completed')
} catch (e) {
  console.error('❌ Migration failed:', e)
  process.exit(1)
}


