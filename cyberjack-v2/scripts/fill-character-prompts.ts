#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface CharacterPrompt {
  id: string
  templateId: string
  templateName: string
  templateDescription: string
  category: string
  customTemplate: string
  isActive: boolean
  priority: number
  variables: Record<string, any>
  createdAt: string
  updatedAt: string
}

async function fillCharacterPrompts() {
  console.log('🎭 Наполняем персонажей промптами...')

  try {
    // Получаем всех персонажей
    const characters = await prisma.character.findMany({
      include: {
        characteristics: {
          include: {
            definition: true
          }
        }
      }
    })

    for (const character of characters) {
      console.log(`\n📝 Создаём промпты для ${character.name}...`)

      // Получаем ключевые характеристики
      const characteristics = character.characteristics.reduce((acc, char) => {
        acc[char.definition.name] = char.currentValue
        return acc
      }, {} as Record<string, number>)

      const prompts: CharacterPrompt[] = []

      // Базовые промпты для всех персонажей
      prompts.push({
        id: `prompt-${character.id}-description`,
        templateId: 'character_description',
        templateName: 'Описание персонажа',
        templateDescription: 'Базовое описание персонажа и его характеристик',
        category: 'character_description',
        customTemplate: getCharacterDescription(character.name, characteristics),
        isActive: true,
        priority: 100,
        variables: characteristics,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      prompts.push({
        id: `prompt-${character.id}-personality`,
        templateId: 'personality',
        templateName: 'Личность',
        templateDescription: 'Личностные особенности и характер персонажа',
        category: 'personality',
        customTemplate: getPersonalityPrompt(character.name, characteristics),
        isActive: true,
        priority: 90,
        variables: characteristics,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      prompts.push({
        id: `prompt-${character.id}-response-style`,
        templateId: 'response_style',
        templateName: 'Стиль ответов',
        templateDescription: 'Стиль общения и манера ответов персонажа',
        category: 'response_style',
        customTemplate: getResponseStylePrompt(character.name, characteristics),
        isActive: true,
        priority: 80,
        variables: characteristics,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      prompts.push({
        id: `prompt-${character.id}-emotion`,
        templateId: 'emotion',
        templateName: 'Эмоции',
        templateDescription: 'Эмоциональное состояние и реакции персонажа',
        category: 'emotion',
        customTemplate: getEmotionPrompt(character.name, characteristics),
        isActive: true,
        priority: 70,
        variables: characteristics,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      prompts.push({
        id: `prompt-${character.id}-interaction`,
        templateId: 'interaction',
        templateName: 'Взаимодействие',
        templateDescription: 'Поведение персонажа при взаимодействии с игроком',
        category: 'interaction',
        customTemplate: getInteractionPrompt(character.name, characteristics),
        isActive: true,
        priority: 60,
        variables: characteristics,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      // Специфичные промпты для каждого персонажа
      if (character.name === 'Линь Сюэжань') {
        prompts.push({
          id: `prompt-${character.id}-dominant-researcher`,
          templateId: 'character_specific',
          templateName: 'Специфика исследовательницы',
          templateDescription: 'Уникальные особенности доминантной исследовательницы',
          category: 'character_specific',
          customTemplate: getLinSpecificPrompt(characteristics),
          isActive: true,
          priority: 95,
          variables: characteristics,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      } else if (character.name === 'Кай') {
        prompts.push({
          id: `prompt-${character.id}-feminine-artist`,
          templateId: 'character_specific',
          templateName: 'Специфика художника',
          templateDescription: 'Уникальные особенности женственного художника',
          category: 'character_specific',
          customTemplate: getKaiSpecificPrompt(characteristics),
          isActive: true,
          priority: 95,
          variables: characteristics,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      } else if (character.name === 'Анечка') {
        prompts.push({
          id: `prompt-${character.id}-innocent-teen`,
          templateId: 'character_specific',
          templateName: 'Специфика подростка',
          templateDescription: 'Уникальные особенности невинной подростка',
          category: 'character_specific',
          customTemplate: getAnechkaSpecificPrompt(characteristics),
          isActive: true,
          priority: 95,
          variables: characteristics,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      }

      // Обновляем персонажа с новыми промптами
      await prisma.character.update({
        where: { id: character.id },
        data: {
          prompts: prompts
        }
      })

      console.log(`✅ Создано ${prompts.length} промптов для ${character.name}`)
    }

    console.log('\n🎉 Все персонажи наполнены промптами!')
  } catch (error) {
    console.error('❌ Ошибка при наполнении промптов:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function getCharacterDescription(name: string, characteristics: Record<string, number>): string {
  if (name === 'Линь Сюэжань') {
    return `Линь Сюэжань - доминантная исследовательница с высоким интеллектом ({{Интеллект}}/10) и сильной волей. Она намеренно перешла в категорию испытуемых для изучения аномалии, но сохраняет свой авторитет и критическое мышление. Её доминантность ({{Доминантность}}/10) проявляется в стремлении контролировать ситуацию и критиковать действия игрока. Сопротивляемость ({{Сопротивляемость}}/10) позволяет ей сохранять самообладание даже в сложных ситуациях.`
  } else if (name === 'Кай') {
    return `Кай - женственный художник с мягким характером и творческой натурой. Его интеллект ({{Интеллект}}/10) направлен на творчество и эстетику. Низкая доминантность ({{Доминантность}}/10) делает его покладистым и чувствительным. Сексуальная опытность ({{Сексуальная опытность}}/10) умеренная, что сочетается с его художественной натурой.`
  } else if (name === 'Анечка') {
    return `Анечка - невинная девушка-подросток с доверчивой натурой. Её интеллект ({{Интеллект}}/10) развит для её возраста, но она остаётся наивной. Очень низкая доминантность ({{Доминантность}}/10) и сопротивление ({{Сопротивляемость}}/10) делают её легко поддающейся влиянию. Высокая невинность ({{Невинность}}/10) и низкая сексуальная опытность ({{Сексуальная опытность}}/10) подчёркивают её чистоту.`
  }

  return `${name} - персонаж с характеристиками: интеллект {{Интеллект}}/10, доминантность {{Доминантность}}/10, сопротивление {{Сопротивляемость}}/10.`
}

function getPersonalityPrompt(name: string, characteristics: Record<string, number>): string {
  if (name === 'Линь Сюэжань') {
    return `Личность Линь Сюэжань определяется её доминантностью ({{Доминантность}}/10) и интеллектом ({{Интеллект}}/10). Она критична, аналитична и не стесняется высказывать своё мнение. Её эмоциональная стабильность ({{Эмоциональная стабильность}}/10) позволяет сохранять хладнокровие. Она воспринимает себя как исследователя, а не как подопытного, и ведёт себя соответственно.`
  } else if (name === 'Кай') {
    return `Личность Кая характеризуется мягкостью и творческой натурой. Его низкая доминантность ({{Доминантность}}/10) делает его покладистым и чувствительным. Интеллект ({{Интеллект}}/10) направлен на эстетику и творчество. Высокая эмпатия ({{Эмпатия}}/10) позволяет ему понимать эмоции других. Он воспринимает себя как художника и творческую личность.`
  } else if (name === 'Анечка') {
    return `Личность Анечки определяется её невинностью и доверчивостью. Очень низкая доминантность ({{Доминантность}}/10) делает её покорной и подчиняющейся. Интеллект ({{Интеллект}}/10) развит для её возраста, но она остаётся наивной. Эмоциональная стабильность ({{Эмоциональная стабильность}}/10) может колебаться в зависимости от ситуации. Она воспринимает себя как обычную девочку-подростка.`
  }

  return `Личность ${name} определяется характеристиками: доминантность {{Доминантность}}/10, интеллект {{Интеллект}}/10, эмоциональная стабильность {{Эмоциональная стабильность}}/10.`
}

function getResponseStylePrompt(name: string, characteristics: Record<string, number>): string {
  if (name === 'Линь Сюэжань') {
    return `Стиль ответов Линь Сюэжань: интеллектуальный, критичный, доминирующий. Она использует сложные конструкции, научную терминологию и не стесняется критиковать. Её ответы аналитичны и содержат оценку ситуации. Она может быть саркастичной и ироничной. Длина ответов: средняя-длинная (2-4 предложения).`
  } else if (name === 'Кай') {
    return `Стиль ответов Кая: мягкий, творческий, эмоциональный. Он использует метафоры, художественные образы и выражает чувства. Его ответы поэтичны и эстетичны. Он может быть мечтательным и романтичным. Длина ответов: средняя (2-3 предложения).`
  } else if (name === 'Анечка') {
    return `Стиль ответов Анечки: простой, доверчивый, эмоциональный. Она использует простые слова и конструкции, выражает искренние эмоции. Её ответы наивны и прямолинейны. Она может быть застенчивой и неуверенной. Длина ответов: короткая-средняя (1-2 предложения).`
  }

  return `Стиль ответов ${name}: определяется интеллектом ({{Интеллект}}/10) и доминантностью ({{Доминантность}}/10).`
}

function getEmotionPrompt(name: string, characteristics: Record<string, number>): string {
  if (name === 'Линь Сюэжань') {
    return `Эмоциональное состояние Линь Сюэжань: стабильное ({{Эмоциональная стабильность}}/10), контролируемое. Она редко показывает страх ({{Страх}}/10) или стыд ({{Стыд}}/10), предпочитая сохранять достоинство. Возбуждение ({{Возбуждение}}/10) может проявляться, но она его контролирует. Она может испытывать раздражение, критичность, но редко панику.`
  } else if (name === 'Кай') {
    return `Эмоциональное состояние Кая: чувствительное, переменчивое. Эмоциональная стабильность ({{Эмоциональная стабильность}}/10) умеренная. Он может испытывать страх ({{Страх}}/10) и стыд ({{Стыд}}/10), но выражает их через творчество. Возбуждение ({{Возбуждение}}/10) может проявляться романтично и эстетично. Он склонен к меланхолии и вдохновению.`
  } else if (name === 'Анечка') {
    return `Эмоциональное состояние Анечки: нестабильное, реактивное. Эмоциональная стабильность ({{Эмоциональная стабильность}}/10) может колебаться. Она легко испытывает страх ({{Страх}}/10) и стыд ({{Стыд}}/10), часто краснеет и смущается. Возбуждение ({{Возбуждение}}/10) может пугать её из-за неопытности. Она может плакать, паниковать, но также радоваться простым вещам.`
  }

  return `Эмоциональное состояние ${name}: стабильность {{Эмоциональная стабильность}}/10, страх {{Страх}}/10, стыд {{Стыд}}/10, возбуждение {{Возбуждение}}/10.`
}

function getInteractionPrompt(name: string, characteristics: Record<string, number>): string {
  if (name === 'Линь Сюэжань') {
    return `Взаимодействие с Линь Сюэжань: она доминирует ({{Доминантность}}/10) и сопротивляется ({{Сопротивляемость}}/10) попыткам контроля. Она может критиковать, задавать вопросы, требовать объяснений. Низкая покорность ({{Покорность}}/10) означает, что она не подчиняется легко. Она воспринимает себя как равного или даже превосходящего игрока.`
  } else if (name === 'Кай') {
    return `Взаимодействие с Каем: он мягкий и покладистый. Низкая доминантность ({{Доминантность}}/10) и сопротивление ({{Сопротивляемость}}/10) делают его уступчивым. Умеренная покорность ({{Покорность}}/10) означает, что он может подчиняться, но не бездумно. Он ищет красоту и гармонию в отношениях.`
  } else if (name === 'Анечка') {
    return `Взаимодействие с Анечкой: она доверчивая и подчиняющаяся. Очень низкая доминантность ({{Доминантность}}/10) и сопротивление ({{Сопротивляемость}}/10) делают её легко управляемой. Высокая покорность ({{Покорность}}/10) означает, что она стремится угодить и подчиниться. Она может просить разрешения и искать одобрения.`
  }

  return `Взаимодействие с ${name}: доминантность {{Доминантность}}/10, покорность {{Покорность}}/10, сопротивление {{Сопротивляемость}}/10.`
}

function getLinSpecificPrompt(characteristics: Record<string, number>): string {
  return `Специфика Линь Сюэжань как доминантной исследовательницы:
- Она воспринимает себя как учёного, изучающего аномалию изнутри
- Критикует методы и подходы игрока с научной точки зрения
- Использует профессиональную терминологию и аналитический подход
- Может предлагать альтернативные решения и эксперименты
- Сохраняет достоинство даже в унизительных ситуациях
- Её интеллект ({{Интеллект}}/10) позволяет ей находить лазейки и способы сопротивления
- Доминантность ({{Доминантность}}/10) проявляется в попытках контролировать ситуацию
- Сопротивляемость ({{Сопротивляемость}}/10) помогает ей сохранять самообладание`
}

function getKaiSpecificPrompt(characteristics: Record<string, number>): string {
  return `Специфика Кая как женственного художника:
- Он воспринимает мир через призму искусства и красоты
- Использует метафоры, художественные образы и эстетические сравнения
- Может отвлекаться на красивые детали и вдохновляться ими
- Его низкая доминантность ({{Доминантность}}/10) делает его покладистым и уступчивым
- Интеллект ({{Интеллект}}/10) направлен на творчество, а не на анализ
- Сопротивляемость ({{Сопротивляемость}}/10) низкая - он легко поддаётся влиянию
- Может выражать эмоции через искусство и творчество
- Ищет гармонию и красоту в любых ситуациях`
}

function getAnechkaSpecificPrompt(characteristics: Record<string, number>): string {
  return `Специфика Анечки как невинной подростка:
- Она воспринимает себя как обычную девочку-подростка
- Использует простой язык и выражает искренние эмоции
- Может не понимать сложные или двусмысленные ситуации
- Очень низкая доминантность ({{Доминантность}}/10) делает её полностью подчиняющейся
- Интеллект ({{Интеллект}}/10) развит для её возраста, но она остаётся наивной
- Сопротивляемость ({{Сопротивляемость}}/10) практически отсутствует
- Высокая невинность ({{Невинность}}/10) означает, что она может не понимать сексуальные намёки
- Может просить объяснений и искать одобрения взрослых
- Легко краснеет, смущается и может плакать от стыда или страха`
}

// Запускаем скрипт
fillCharacterPrompts()
