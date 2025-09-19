# ДЕТАЛЬНАЯ АРХИТЕКТУРА И ТЗ: CYBERJACK v2.0

## 🏗️ **АРХИТЕКТУРА СИСТЕМЫ**

### **1. Общая структура проекта**
```
cyberjack-v2/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Группа маршрутов с аутентификацией
│   │   ├── db/                   # Интерфейс базы данных
│   │   │   ├── page.tsx          # Главная страница БД
│   │   │   ├── characters/       # Управление персонажами
│   │   │   ├── users/            # Управление пользователями
│   │   │   └── system/           # Системные настройки
│   │   ├── admin/                # Админ-панель
│   │   │   ├── page.tsx          # Главная админ-панель
│   │   │   ├── characteristics/  # Настройка характеристик
│   │   │   ├── actions/          # Настройка действий
│   │   │   ├── poses/            # Настройка поз
│   │   │   ├── anatomy/          # Настройка анатомии
│   │   │   └── story/            # Сюжетный конструктор
│   │   └── game/                 # Игровой интерфейс
│   │       ├── page.tsx          # Главная игровая страница
│   │       ├── character/[id]/   # Взаимодействие с персонажем
│   │       └── chat/[id]/        # Чат с персонажем
│   ├── api/                      # API endpoints
│   │   ├── auth/                 # Аутентификация
│   │   ├── characters/           # CRUD персонажей
│   │   ├── users/                # CRUD пользователей
│   │   ├── characteristics/      # Управление характеристиками
│   │   ├── actions/              # Выполнение действий
│   │   ├── chat/                 # Чат с ИИ
│   │   └── time/                 # Управление временем
│   ├── globals.css               # Глобальные стили
│   ├── layout.tsx                # Корневой layout
│   └── page.tsx                  # Главная страница
├── lib/                          # Библиотеки и утилиты
│   ├── db/                       # База данных
│   │   ├── schema.ts             # Prisma схема
│   │   ├── migrations/           # Миграции БД
│   │   └── seed.ts               # Начальные данные
│   ├── core/                     # Основные системы
│   │   ├── characteristics/      # Система характеристик
│   │   ├── time/                 # Система времени
│   │   ├── recovery/             # Система восстановления
│   │   └── formulas/             # Система формул
│   ├── character/                # Character AI
│   │   ├── ai-service.ts         # Основной AI сервис
│   │   ├── prompt-system.ts      # Система промптов
│   │   ├── memory-manager.ts     # Управление памятью
│   │   └── response-manager.ts   # Генерация ответов
│   ├── story/                    # Сюжетный конструктор
│   │   ├── graph-editor.ts       # Граф-редактор
│   │   ├── scene-manager.ts      # Управление сценами
│   │   └── story-points.ts       # Сюжетные точки
│   └── utils/                    # Утилиты
│       ├── validation.ts         # Валидация данных
│       ├── calculations.ts       # Математические расчеты
│       └── helpers.ts            # Вспомогательные функции
├── components/                   # UI компоненты
│   ├── ui/                       # Базовые UI компоненты
│   ├── forms/                    # Формы
│   ├── charts/                   # Графики и диаграммы
│   ├── character/                # Компоненты персонажей
│   ├── admin/                    # Админские компоненты
│   └── game/                     # Игровые компоненты
├── types/                        # TypeScript типы
│   ├── database.ts               # Типы БД
│   ├── game.ts                   # Игровые типы
│   └── api.ts                    # API типы
├── hooks/                        # React хуки
│   ├── use-characteristics.ts    # Хук характеристик
│   ├── use-time.ts               # Хук времени
│   ├── use-actions.ts            # Хук действий
│   └── use-chat.ts               # Хук чата
├── middleware.ts                 # Next.js middleware
├── next.config.js                # Конфигурация Next.js
├── tailwind.config.js            # Конфигурация Tailwind
├── tsconfig.json                 # Конфигурация TypeScript
└── package.json                  # Зависимости
```

### **2. Технологический стек**
- **Frontend**: Next.js 15, React 19, TypeScript
- **Database**: PostgreSQL с Prisma ORM
- **UI**: Tailwind CSS, Radix UI, Framer Motion
- **AI**: OpenRouter API (GLM 4.5)
- **Graph Editor**: React Flow
- **Authentication**: NextAuth.js
- **Validation**: Zod
- **Testing**: Jest, Testing Library, Playwright

### **3. Архитектурные принципы**
- **Модульность**: каждый компонент независим
- **Единый источник истины**: только база данных
- **Типобезопасность**: полное покрытие TypeScript
- **Тестируемость**: каждый модуль покрыт тестами
- **Масштабируемость**: легко добавлять новые функции

## 🗄️ **СИСТЕМА ДАННЫХ**

### **1. Схема базы данных (Prisma)**

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Пользователи
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      UserRole @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Модификаторы для формул
  modifiers Json     @default("{}")

  // Кредиты
  credits   Int      @default(1000)

  // Независимые копии персонажей
  characterCopies CharacterCopy[]

  // Знания о персонажах
  characterKnowledge CharacterKnowledge[]

  // Сессии
  sessions Session[]
}

enum UserRole {
  USER
  ADMIN
  SUPER_ADMIN
}

// Персонажи (базовые)
model Character {
  id          String   @id @default(cuid())
  name        String
  description String?
  age         Int?
  avatar      String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Характеристики
  characteristics Characteristic[]

  // Анатомия
  anatomy CharacterAnatomy[]

  // Позы
  poses CharacterPose[]

  // Промпты для ИИ
  prompts Json @default("{}")

  // Копии у пользователей
  copies CharacterCopy[]

  // Знания пользователей
  knowledge CharacterKnowledge[]
}

// Характеристики персонажа
model Characteristic {
  id                String   @id @default(cuid())
  characterId       String
  characteristicDefId String

  // Текущее и базовое значение
  currentValue      Float
  baseValue         Float

  // Система восстановления
  recoveryRate      Float    @default(1.0)
  shiftThreshold    Int      @default(60)    // минуты
  shiftRate         Float    @default(0.1)
  timeInAlteredState Int     @default(0)     // минуты

  // Временные метки
  lastChanged       DateTime @default(now())
  lastRecovery      DateTime @default(now())

  character         Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
  definition        CharacteristicDefinition @relation(fields: [characteristicDefId], references: [id])

  @@unique([characterId, characteristicDefId])
}

// Определения характеристик
model CharacteristicDefinition {
  id          String   @id @default(cuid())
  name        String
  category    String
  description String?
  minValue    Float    @default(0)
  maxValue    Float    @default(100)
  isActive    Boolean  @default(true)

  // Характеристики персонажей
  characteristics Characteristic[]

  // Знания пользователей
  knowledge CharacterKnowledge[]
}

// Анатомия персонажа
model CharacterAnatomy {
  id                String   @id @default(cuid())
  characterId       String
  anatomyDefId      String

  hasPart           Boolean  @default(false)
  sensitivity       Float    @default(50)  // 0-100

  character         Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
  definition        AnatomyDefinition @relation(fields: [anatomyDefId], references: [id])

  @@unique([characterId, anatomyDefId])
}

// Определения анатомии
model AnatomyDefinition {
  id          String   @id @default(cuid())
  name        String
  category    String?
  description String?
  isActive    Boolean  @default(true)

  // Анатомия персонажей
  anatomy CharacterAnatomy[]
}

// Позы персонажа
model CharacterPose {
  id          String   @id @default(cuid())
  characterId String
  poseDefId   String

  // Настройки позы для конкретного персонажа
  customSettings Json   @default("{}")

  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
  definition  PoseDefinition @relation(fields: [poseDefId], references: [id])

  @@unique([characterId, poseDefId])
}

// Определения поз
model PoseDefinition {
  id          String   @id @default(cuid())
  name        String
  category    String
  description String?

  // Влияние на характеристики
  effects     Json     @default("{}")

  // Условия применения
  requirements Json    @default("{}")

  // Ракурсы
  angles      PoseAngle[]

  // Позы персонажей
  poses       CharacterPose[]

  isActive    Boolean  @default(true)
}

// Ракурсы поз
model PoseAngle {
  id          String   @id @default(cuid())
  poseDefId   String
  name        String
  angle       String   // "front", "back", "side", etc.

  // Медиа
  media       Json     @default("{}") // {images: [], videos: [], gifs: []}

  // Активные зоны
  zones       ActiveZone[]

  pose        PoseDefinition @relation(fields: [poseDefId], references: [id], onDelete: Cascade)
}

// Активные зоны
model ActiveZone {
  id          String   @id @default(cuid())
  angleId     String
  anatomyDefId String?

  name        String
  x           Float    // координаты на изображении
  y           Float
  width       Float
  height      Float

  // Связь с анатомией
  anatomy     AnatomyDefinition? @relation(fields: [anatomyDefId], references: [id])
  angle       PoseAngle @relation(fields: [angleId], references: [id], onDelete: Cascade)
}

// Действия/Инструменты
model Action {
  id          String   @id @default(cuid())
  name        String
  category    String
  description String?

  // Свойства действия
  intensity   Float    @default(5)    // 0-100
  cost        Int      @default(10)   // кредиты
  duration    Int      @default(30)   // секунды

  // Эффекты на характеристики
  effects     Json     @default("{}")

  // Условия применения
  requirements Json    @default("{}")

  isActive    Boolean  @default(true)
}

// Копии персонажей у пользователей
model CharacterCopy {
  id          String   @id @default(cuid())
  userId      String
  characterId String

  // Настройки копии
  settings    Json     @default("{}")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)

  @@unique([userId, characterId])
}

// Знания пользователей о персонажах
model CharacterKnowledge {
  id                String   @id @default(cuid())
  userId            String
  characterId       String
  characteristicDefId String?

  // Уровень знания
  level             KnowledgeLevel @default(UNKNOWN)
  value             Float?
  accuracy          Float?
  lastRevealed      DateTime?

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  character         Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
  characteristic    CharacteristicDefinition? @relation(fields: [characteristicDefId], references: [id])

  @@unique([userId, characterId, characteristicDefId])
}

enum KnowledgeLevel {
  UNKNOWN
  APPROXIMATE
  DETAILED
  PRECISE
}

// Сессии пользователей
model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Сюжетные точки
model StoryPoint {
  id          String   @id @default(cuid())
  name        String
  type        StoryPointType
  category    String?
  description String?

  // Значения
  defaultValue Float?
  minValue     Float?
  maxValue     Float?

  // Теги для организации
  tags        String[]

  isActive    Boolean  @default(true)
}

enum StoryPointType {
  NUMERIC
  BOOLEAN
  STRING
}

// Сцены
model Scene {
  id          String   @id @default(cuid())
  name        String
  type        String
  description String?

  // Условия активации
  triggerConditions Json @default("{}")
  probability       Float @default(100)

  // Экраны сцены
  screens     Screen[]

  isActive    Boolean  @default(true)
}

// Экраны сцены
model Screen {
  id          String   @id @default(cuid())
  sceneId     String
  name        String
  description String?

  // Контент экрана
  content     Json     @default("{}")

  // Выборы
  choices     Choice[]

  // Условия доступа
  accessConditions Json @default("{}")

  scene       Scene    @relation(fields: [sceneId], references: [id], onDelete: Cascade)
}

// Выборы в экранах
model Choice {
  id          String   @id @default(cuid())
  screenId    String
  text        String
  description String?

  // Последствия выбора
  consequences Json    @default("{}")

  // Условия показа
  showConditions Json  @default("{}")

  screen      Screen   @relation(fields: [screenId], references: [id], onDelete: Cascade)
}

// Сущности станции
model StationEntity {
  id          String   @id @default(cuid())
  name        String
  type        String
  description String?

  // Связанные сцены
  defaultSceneId String?
  customSceneId  String?

  // Настройки
  probability Float    @default(20)
  isActive    Boolean  @default(true)

  // Метаданные
  metadata    Json     @default("{}")
}
```

### **2. Система времени**

```typescript
// lib/core/time/time-system.ts

export class TimeSystem {
  private static instance: TimeSystem
  private gameTime: number = 0 // минуты игрового времени
  private lastUpdate: number = Date.now()
  private isRunning: boolean = false
  private actionHoldStart: number | null = null

  static getInstance(): TimeSystem {
    if (!TimeSystem.instance) {
      TimeSystem.instance = new TimeSystem()
    }
    return TimeSystem.instance
  }

  // Получить текущее игровое время
  getGameTime(): number {
    return this.gameTime
  }

  // Получить игровое время в читаемом формате
  getFormattedTime(): string {
    const hours = Math.floor(this.gameTime / 60)
    const minutes = this.gameTime % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Начать холд действия
  startActionHold(): void {
    this.actionHoldStart = Date.now()
    this.isRunning = true
  }

  // Остановить холд действия
  stopActionHold(): void {
    this.actionHoldStart = null
    this.isRunning = false
  }

  // Обновить время (вызывается каждую секунду при холде)
  update(): void {
    if (!this.isRunning || !this.actionHoldStart) return

    const now = Date.now()
    const deltaTime = (now - this.lastUpdate) / 1000 // секунды

    // 1 секунда реального времени = 1 минута игрового времени
    if (deltaTime >= 1) {
      this.gameTime += 1
      this.lastUpdate = now

      // Запустить восстановление характеристик
      this.triggerRecovery()
    }
  }

  // Ручное управление временем
  advanceTime(minutes: number): void {
    this.gameTime += minutes
    this.triggerRecovery()
  }

  // Запустить восстановление характеристик
  private triggerRecovery(): void {
    // Здесь будет логика восстановления характеристик
    console.log(`Время обновлено: ${this.getFormattedTime()}`)
  }
}
```

### **3. Система характеристик**

```typescript
// lib/core/characteristics/characteristics-system.ts

export class CharacteristicsSystem {
  // Получить текущее значение характеристики
  async getCurrentValue(characterId: string, characteristicId: string): Promise<number> {
    const characteristic = await prisma.characteristic.findUnique({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      }
    })
    return characteristic?.currentValue || 0
  }

  // Изменить значение характеристики
  async changeValue(
    characterId: string,
    characteristicId: string,
    change: number,
    permanent: boolean = false
  ): Promise<void> {
    const characteristic = await prisma.characteristic.findUnique({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) return

    const newValue = Math.max(0, Math.min(100, characteristic.currentValue + change))

    await prisma.characteristic.update({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      },
      data: {
        currentValue: newValue,
        lastChanged: new Date(),
        timeInAlteredState: permanent ? 0 : characteristic.timeInAlteredState + 1
      }
    })

    // Если постоянное изменение, сдвигаем базовое значение
    if (permanent) {
      await this.shiftBaseValue(characterId, characteristicId, change)
    }

    // Проверить раскрытие характеристики
    await this.checkReveal(characterId, characteristicId, newValue)
  }

  // Восстановление к базовому значению
  async recoverToBase(characterId: string, characteristicId: string): Promise<void> {
    const characteristic = await prisma.characteristic.findUnique({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) return

    const difference = characteristic.baseValue - characteristic.currentValue
    const recoveryAmount = Math.sign(difference) * Math.min(
      Math.abs(difference),
      characteristic.recoveryRate
    )

    if (recoveryAmount !== 0) {
      await prisma.characteristic.update({
        where: {
          characterId_characteristicDefId: {
            characterId,
            characteristicDefId: characteristicId
          }
        },
        data: {
          currentValue: characteristic.currentValue + recoveryAmount,
          lastRecovery: new Date()
        }
      })
    }
  }

  // Сдвиг базового значения
  private async shiftBaseValue(
    characterId: string,
    characteristicId: string,
    change: number
  ): Promise<void> {
    const characteristic = await prisma.characteristic.findUnique({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) return

    const newBaseValue = Math.max(0, Math.min(100, characteristic.baseValue + change))

    await prisma.characteristic.update({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      },
      data: {
        baseValue: newBaseValue
      }
    })
  }

  // Проверка раскрытия характеристики
  private async checkReveal(
    characterId: string,
    characteristicId: string,
    newValue: number
  ): Promise<void> {
    const characteristic = await prisma.characteristic.findUnique({
      where: {
        characterId_characteristicDefId: {
          characterId,
          characteristicDefId: characteristicId
        }
      }
    })

    if (!characteristic) return

    const changePercent = Math.abs(newValue - characteristic.baseValue) / characteristic.baseValue * 100
    let newLevel: KnowledgeLevel = KnowledgeLevel.UNKNOWN

    if (changePercent >= 60) {
      newLevel = KnowledgeLevel.PRECISE
    } else if (changePercent >= 40) {
      newLevel = KnowledgeLevel.DETAILED
    } else if (changePercent >= 20) {
      newLevel = KnowledgeLevel.APPROXIMATE
    }

    // Обновить знания всех пользователей
    await prisma.characterKnowledge.updateMany({
      where: {
        characterId,
        characteristicDefId: characteristicId,
        level: {
          not: newLevel
        }
      },
      data: {
        level: newLevel,
        value: this.calculateRevealedValue(newValue, newLevel),
        accuracy: this.getAccuracy(newLevel),
        lastRevealed: new Date()
      }
    })
  }

  // Вычислить раскрытое значение
  private calculateRevealedValue(actualValue: number, level: KnowledgeLevel): number {
    switch (level) {
      case KnowledgeLevel.PRECISE:
        return actualValue
      case KnowledgeLevel.DETAILED:
        return actualValue + (Math.random() - 0.5) * actualValue * 0.3 // ±15%
      case KnowledgeLevel.APPROXIMATE:
        return actualValue + (Math.random() - 0.5) * actualValue * 0.6 // ±30%
      default:
        return 0
    }
  }

  // Получить точность для уровня
  private getAccuracy(level: KnowledgeLevel): number {
    switch (level) {
      case KnowledgeLevel.PRECISE:
        return 0
      case KnowledgeLevel.DETAILED:
        return 15
      case KnowledgeLevel.APPROXIMATE:
        return 30
      default:
        return 100
    }
  }
}
```

## 🎮 **ИГРОВЫЕ СИСТЕМЫ**

### **1. Character AI система**

```typescript
// lib/character/ai-service.ts

export class CharacterAIService {
  private openRouterApiKey: string
  private model: string = 'z-ai/glm-4.5'

  constructor(apiKey: string) {
    this.openRouterApiKey = apiKey
  }

  // Генерация ответа персонажа
  async generateResponse(
    characterId: string,
    userMessage: string,
    context: {
      lastAction?: string
      currentPose?: string
      userModifiers?: Record<string, number>
    }
  ): Promise<string> {
    const character = await this.getCharacter(characterId)
    const prompt = await this.buildPrompt(character, userMessage, context)

    const response = await this.callOpenRouter(prompt)
    return response
  }

  // Построение промпта
  private async buildPrompt(
    character: any,
    userMessage: string,
    context: any
  ): Promise<string> {
    const characteristics = await this.getCharacterCharacteristics(character.id)
    const recentActions = await this.getRecentActions(character.id)
    const memory = await this.getCharacterMemory(character.id)

    return `
Ты - ${character.name}, ${character.description}

Твои текущие характеристики:
${this.formatCharacteristics(characteristics)}

Последние действия: ${recentActions.join(', ')}

Память: ${memory}

Сообщение пользователя: "${userMessage}"

Ответь как ${character.name}, учитывая свои характеристики и текущее состояние.
    `.trim()
  }

  // Вызов OpenRouter API
  private async callOpenRouter(prompt: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.8
      })
    })

    const data = await response.json()
    return data.choices[0]?.message?.content || 'Извините, я не могу ответить сейчас.'
  }
}
```

### **2. Система действий**

```typescript
// lib/core/actions/actions-system.ts

export class ActionsSystem {
  // Выполнить действие
  async executeAction(
    characterId: string,
    actionId: string,
    userId: string,
    zoneId?: string
  ): Promise<ActionResult> {
    const action = await prisma.action.findUnique({
      where: { id: actionId }
    })

    if (!action) {
      throw new Error('Действие не найдено')
    }

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        characteristics: {
          include: {
            definition: true
          }
        },
        anatomy: {
          include: {
            definition: true
          }
        }
      }
    })

    if (!character) {
      throw new Error('Персонаж не найден')
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw new Error('Пользователь не найден')
    }

    // Вычислить эффекты действия
    const effects = await this.calculateEffects(action, character, user, zoneId)

    // Применить эффекты
    for (const effect of effects) {
      await this.applyEffect(characterId, effect)
    }

    // Создать запись о действии
    await this.logAction(characterId, actionId, userId, effects)

    return {
      success: true,
      effects,
      message: `Действие "${action.name}" выполнено`
    }
  }

  // Вычислить эффекты действия
  private async calculateEffects(
    action: any,
    character: any,
    user: any,
    zoneId?: string
  ): Promise<ActionEffect[]> {
    const effects: ActionEffect[] = []
    const actionEffects = action.effects as Record<string, any>

    for (const [characteristicId, effectData] of Object.entries(actionEffects)) {
      let baseChange = effectData.change || 0

      // Модификатор от интенсивности действия
      baseChange *= (action.intensity / 100)

      // Модификатор от пользователя
      const userModifier = user.modifiers[characteristicId] || 1
      baseChange *= userModifier

      // Модификатор от зоны (если есть)
      if (zoneId) {
        const zone = await this.getZone(zoneId)
        if (zone?.anatomy) {
          const anatomy = character.anatomy.find(a => a.definition.id === zone.anatomy.id)
          if (anatomy) {
            baseChange *= (anatomy.sensitivity / 100)
          }
        }
      }

      effects.push({
        characteristicId,
        change: baseChange,
        permanent: effectData.permanent || false
      })
    }

    return effects
  }

  // Применить эффект
  private async applyEffect(
    characterId: string,
    effect: ActionEffect
  ): Promise<void> {
    const characteristicsSystem = new CharacteristicsSystem()
    await characteristicsSystem.changeValue(
      characterId,
      effect.characteristicId,
      effect.change,
      effect.permanent
    )
  }
}
```

## 📱 **ПОЛЬЗОВАТЕЛЬСКИЕ ИНТЕРФЕЙСЫ**

### **1. Интерфейс базы данных (`/db`)**

```typescript
// app/(auth)/db/page.tsx

export default function DatabaseInterface() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Интерфейс базы данных</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Персонажи</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Управление персонажами и их характеристиками</p>
            <Button asChild className="mt-4">
              <Link href="/db/characters">Открыть</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Пользователи</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Управление пользователями и их данными</p>
            <Button asChild className="mt-4">
              <Link href="/db/users">Открыть</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Система</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Системные настройки и конфигурации</p>
            <Button asChild className="mt-4">
              <Link href="/db/system">Открыть</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### **2. Админ-панель (`/admin`)**

```typescript
// app/(auth)/admin/page.tsx

export default function AdminPanel() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Админ-панель</h1>

      <Tabs defaultValue="characteristics" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="characteristics">Характеристики</TabsTrigger>
          <TabsTrigger value="actions">Действия</TabsTrigger>
          <TabsTrigger value="poses">Позы</TabsTrigger>
          <TabsTrigger value="anatomy">Анатомия</TabsTrigger>
          <TabsTrigger value="story">Сюжет</TabsTrigger>
        </TabsList>

        <TabsContent value="characteristics">
          <CharacteristicsAdmin />
        </TabsContent>

        <TabsContent value="actions">
          <ActionsAdmin />
        </TabsContent>

        <TabsContent value="poses">
          <PosesAdmin />
        </TabsContent>

        <TabsContent value="anatomy">
          <AnatomyAdmin />
        </TabsContent>

        <TabsContent value="story">
          <StoryAdmin />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### **3. Игровой интерфейс (`/game`)**

```typescript
// app/(auth)/game/page.tsx

export default function GameInterface() {
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null)
  const [currentPose, setCurrentPose] = useState<string | null>(null)
  const [isActionHolding, setIsActionHolding] = useState(false)

  return (
    <div className="container mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Список персонажей */}
        <div className="lg:col-span-1">
          <CharacterList
            onSelect={setSelectedCharacter}
            selected={selectedCharacter}
          />
        </div>

        {/* Основная область */}
        <div className="lg:col-span-2">
          {selectedCharacter ? (
            <div className="space-y-6">
              {/* Отображение персонажа */}
              <CharacterDisplay
                characterId={selectedCharacter}
                currentPose={currentPose}
                onPoseChange={setCurrentPose}
              />

              {/* Панель действий */}
              <ActionsPanel
                characterId={selectedCharacter}
                onActionStart={() => setIsActionHolding(true)}
                onActionEnd={() => setIsActionHolding(false)}
                isHolding={isActionHolding}
              />

              {/* Чат */}
              <ChatPanel characterId={selectedCharacter} />
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Выберите персонажа для взаимодействия</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

## 🔧 **API ENDPOINTS**

### **1. Управление характеристиками**

```typescript
// app/api/characteristics/[characterId]/[characteristicId]/route.ts

export async function PATCH(
  request: Request,
  { params }: { params: { characterId: string, characteristicId: string } }
) {
  const { change, permanent } = await request.json()

  const characteristicsSystem = new CharacteristicsSystem()
  await characteristicsSystem.changeValue(
    params.characterId,
    params.characteristicId,
    change,
    permanent
  )

  return Response.json({ success: true })
}
```

### **2. Выполнение действий**

```typescript
// app/api/actions/execute/route.ts

export async function POST(request: Request) {
  const { characterId, actionId, userId, zoneId } = await request.json()

  const actionsSystem = new ActionsSystem()
  const result = await actionsSystem.executeAction(
    characterId,
    actionId,
    userId,
    zoneId
  )

  return Response.json(result)
}
```

### **3. Чат с ИИ**

```typescript
// app/api/chat/[characterId]/route.ts

export async function POST(
  request: Request,
  { params }: { params: { characterId: string } }
) {
  const { message, userId } = await request.json()

  const aiService = new CharacterAIService(process.env.OPENROUTER_API_KEY!)
  const response = await aiService.generateResponse(
    params.characterId,
    message,
    { userId }
  )

  return Response.json({ response })
}
```

## 🧪 **ТЕСТИРОВАНИЕ**

### **1. Unit тесты**

```typescript
// __tests__/characteristics-system.test.ts

describe('CharacteristicsSystem', () => {
  test('should change characteristic value', async () => {
    const system = new CharacteristicsSystem()
    await system.changeValue('char1', 'mood', 10)

    const value = await system.getCurrentValue('char1', 'mood')
    expect(value).toBe(60) // 50 + 10
  })

  test('should reveal characteristic on significant change', async () => {
    const system = new CharacteristicsSystem()
    await system.changeValue('char1', 'mood', 30) // 60% change

    const knowledge = await prisma.characterKnowledge.findFirst({
      where: {
        characterId: 'char1',
        characteristicDefId: 'mood'
      }
    })

    expect(knowledge?.level).toBe(KnowledgeLevel.PRECISE)
  })
})
```

### **2. Integration тесты**

```typescript
// __tests__/integration/game-flow.test.ts

describe('Game Flow Integration', () => {
  test('should complete full action flow', async () => {
    // 1. Выбрать персонажа
    const character = await createTestCharacter()

    // 2. Выполнить действие
    const action = await createTestAction()
    const result = await executeAction(character.id, action.id, 'user1')

    // 3. Проверить изменения
    expect(result.success).toBe(true)
    expect(result.effects).toHaveLength(1)

    // 4. Проверить раскрытие характеристик
    const knowledge = await getCharacterKnowledge('user1', character.id, 'mood')
    expect(knowledge.level).not.toBe(KnowledgeLevel.UNKNOWN)
  })
})
```

### **3. E2E тесты**

```typescript
// __tests__/e2e/game-workflow.test.ts

test('complete game workflow', async ({ page }) => {
  // 1. Войти в систему
  await page.goto('/login')
  await page.fill('[data-testid=email]', 'test@example.com')
  await page.fill('[data-testid=password]', 'password')
  await page.click('[data-testid=login-button]')

  // 2. Перейти в игру
  await page.goto('/game')

  // 3. Выбрать персонажа
  await page.click('[data-testid=character-card]:first-child')

  // 4. Выполнить действие
  await page.click('[data-testid=action-button]')
  await page.mouse.down('[data-testid=action-zone]')
  await page.waitForTimeout(2000) // 2 секунды холда = 2 минуты игрового времени
  await page.mouse.up()

  // 5. Проверить изменения
  await expect(page.locator('[data-testid=characteristic-value]')).toContainText('60')

  // 6. Отправить сообщение в чат
  await page.fill('[data-testid=chat-input]', 'Привет!')
  await page.click('[data-testid=send-button]')

  // 7. Проверить ответ ИИ
  await expect(page.locator('[data-testid=ai-response]')).toBeVisible()
})
```

## 🚀 **ПЛАН РЕАЛИЗАЦИИ**

### **Этап 1: Базовая инфраструктура (1-2 недели)**
1. Настройка Next.js проекта
2. Настройка PostgreSQL + Prisma
3. Базовая аутентификация
4. Создание схемы БД
5. Базовые API endpoints

### **Этап 2: Система характеристик (2-3 недели)**
1. Реализация CharacteristicsSystem
2. Система восстановления и сдвига базы
3. Система раскрытия характеристик
4. API для управления характеристиками
5. Unit тесты

### **Этап 3: Character AI (2-3 недели)**
1. Интеграция с OpenRouter API
2. Система промптов
3. Управление памятью персонажей
4. Чат с ИИ
5. Integration тесты

### **Этап 4: Игровые системы (3-4 недели)**
1. Система действий и эффектов
2. Система поз и ракурсов
3. Активные зоны
4. Система времени
5. Формулы влияния

### **Этап 5: Пользовательские интерфейсы (3-4 недели)**
1. Интерфейс БД (`/db`)
2. Админ-панель (`/admin`)
3. Игровой интерфейс (`/game`)
4. Мобильная адаптация
5. E2E тесты

### **Этап 6: Дополнительные системы (2-3 недели)**
1. Сюжетный конструктор
2. Система анатомии
3. Экономическая система
4. Экспорт/импорт данных
5. Финальное тестирование

---

## 🎯 **КЛЮЧЕВЫЕ ОСОБЕННОСТИ СИСТЕМЫ**

### **1. Система времени с холдом**
- **1 секунда реального времени = 1 минута игрового времени** ТОЛЬКО при холде действия
- Ручное управление временем через кнопки
- Автоматическое восстановление характеристик каждую минуту игрового времени

### **2. 100-балльная система характеристик**
- Все характеристики: 0-100
- Базовые значения с восстановлением
- Сдвиг базы при длительном нахождении в измененном состоянии

### **3. Упрощенная система раскрытия**
- **approximate**: ±30% от реального значения
- **detailed**: ±15% от реального значения
- **precise**: точное значение
- Раскрытие через наблюдение изменений (20%/40%/60% от базового)

### **4. Модульная архитектура**
- Четкое разделение на модули
- Единый источник истины (БД)
- Полная типобезопасность
- Покрытие тестами

### **5. Три основные страницы**
- **`/db`** - Интерфейс базы данных
- **`/admin`** - Полная админ-панель
- **`/game`** - Игровой интерфейс

---

**Это детальное ТЗ покрывает все аспекты системы. Готов приступить к реализации!**

