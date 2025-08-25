// Скрипт для очистки кэша конфигурации
console.log('🧹 Очищаем кэш конфигурации...')

// Очищаем кэш Next.js
const fs = require('fs')
const path = require('path')

// Удаляем кэш Next.js
const nextCachePath = path.join(process.cwd(), '.next')
if (fs.existsSync(nextCachePath)) {
  console.log('🗑️ Удаляем кэш Next.js...')
  fs.rmSync(nextCachePath, { recursive: true, force: true })
}

// Удаляем кэш TypeScript
const tsCachePath = path.join(process.cwd(), 'tsconfig.tsbuildinfo')
if (fs.existsSync(tsCachePath)) {
  console.log('🗑️ Удаляем кэш TypeScript...')
  fs.unlinkSync(tsCachePath)
}

// Очищаем node_modules/.cache если есть
const nodeCachePath = path.join(process.cwd(), 'node_modules', '.cache')
if (fs.existsSync(nodeCachePath)) {
  console.log('🗑️ Удаляем кэш node_modules...')
  fs.rmSync(nodeCachePath, { recursive: true, force: true })
}

console.log('✅ Кэш очищен! Перезапустите dev сервер.')
