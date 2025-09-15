#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Список файлов для исправления
const filesToFix = [
  'src/app/api/users/[id]/equipment/[equipmentId]/use/route.ts',
  'src/app/api/users/[id]/equipment/[equipmentId]/buy/route.ts',
  'src/app/api/actions/history/[characterId]/route.ts',
  'src/app/api/actions/stats/[characterId]/route.ts',
  'src/app/api/story/entities/[id]/route.ts',
  'src/app/api/story/points/[id]/route.ts',
  'src/app/api/equipment/[id]/route.ts',
  'src/app/api/characters/[id]/anatomy/[anatomyId]/route.ts',
  'src/app/api/anatomy/[id]/route.ts',
  'src/app/api/actions/[id]/route.ts',
  'src/app/api/characteristics/[characterId]/[characteristicId]/route.ts'
]

function fixParamsAwait(content: string): string {
  // Исправляем типы params
  content = content.replace(
    /{ params }: { params: { ([^}]+) } }/g,
    '{ params }: { params: Promise<{ $1 }> }'
  )

  // Добавляем await params в начале функций
  content = content.replace(
    /export async function (GET|POST|PUT|DELETE|PATCH)\(\s*request: NextRequest,\s*{ params }: { params: Promise<{ ([^}]+) }> }\s*\)\s*{\s*try\s*{/g,
    (match, method, paramsType) => {
      const paramNames = paramsType.split(',').map((p: string) => p.trim().split(':')[0].trim())
      const destructuring = paramNames.join(', ')
      return `export async function ${method}(
  request: NextRequest,
  { params }: { params: Promise<{ ${paramsType} }> }
) {
  try {
    const { ${destructuring} } = await params`
    }
  )

  // Заменяем использование params.property на property
  const paramNames = content.match(/{ params }: { params: Promise<{ ([^}]+) }> }/g)
  if (paramNames) {
    paramNames.forEach(match => {
      const paramsType = match.match(/{ params }: { params: Promise<{ ([^}]+) }> }/)?.[1]
      if (paramsType) {
        const names = paramsType.split(',').map(p => p.trim().split(':')[0].trim())
        names.forEach(name => {
          const regex = new RegExp(`params\\.${name}`, 'g')
          content = content.replace(regex, name)
        })
      }
    })
  }

  return content
}

console.log('🔧 Исправление await params в API роутах...')

filesToFix.forEach(filePath => {
  try {
    const fullPath = join(process.cwd(), filePath)
    const content = readFileSync(fullPath, 'utf-8')
    const fixedContent = fixParamsAwait(content)

    if (content !== fixedContent) {
      writeFileSync(fullPath, fixedContent, 'utf-8')
      console.log(`✅ Исправлен: ${filePath}`)
    } else {
      console.log(`⏭️  Пропущен (уже исправлен): ${filePath}`)
    }
  } catch (error) {
    console.error(`❌ Ошибка при исправлении ${filePath}:`, error)
  }
})

console.log('🎉 Исправление завершено!')
