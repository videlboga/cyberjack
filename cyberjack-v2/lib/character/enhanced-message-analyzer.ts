// lib/character/enhanced-message-analyzer.ts

import { prisma } from '@/lib/db/client'
import {
  MessageAnalysis,
  PoseCommand,
  CharacteristicInfluence,
  ActionTrigger,
  FetishElement,
  MoodChange
} from '@/types/character-ai'

export class EnhancedMessageAnalyzer {
  private readonly POSE_KEYWORDS = {
    'стоя': ['стоять', 'встать', 'стой', 'стоя'],
    'сидя': ['сидеть', 'сядь', 'сидя', 'присядь'],
    'лежа': ['лежать', 'ляг', 'лежа', 'приляг'],
    'на коленях': ['колени', 'встать на колени', 'на коленях', 'присядь на колени'],
    'распростертая': ['распростертая', 'раскинуться', 'разложиться'],
    'скрученная': ['скрутиться', 'свернуться', 'скрученная'],
    'доминирующая': ['доминировать', 'властвовать', 'командовать'],
    'покорная': ['покориться', 'подчиниться', 'покорная']
  }

  // Удалено: система анализа через ключевые слова заменена на AI анализ

  private readonly FETISH_KEYWORDS = {
    'невинность': ['невинность', 'чистота', 'девственность', 'невинный', 'чистый'],
    'покорность': ['покорность', 'подчинение', 'послушание', 'покорный', 'послушный'],
    'чувствительность': ['чувствительность', 'нежность', 'мягкость', 'чувствительный'],
    'агрессивность': ['агрессивность', 'доминирование', 'контроль', 'власть'],
    'унижение': ['унижение', 'унижать', 'оскорбление', 'позор'],
    'бондаж': ['бондаж', 'связывание', 'ограничение', 'связать'],
    'доминирование': ['доминирование', 'власть', 'контроль', 'командование']
  }

  private readonly ACTION_KEYWORDS = {
    'прикосновение': ['прикоснуться', 'трогать', 'касаться', 'погладить'],
    'поцелуй': ['поцеловать', 'целовать', 'поцелуй', 'целую'],
    'объятие': ['обнять', 'обнимать', 'объятие', 'прижать'],
    'удар': ['ударить', 'бить', 'шлепнуть', 'удар'],
    'ласка': ['ласкать', 'нежить', 'ласка', 'нежность'],
    'наказание': ['наказать', 'наказание', 'наказание', 'дисциплина'],
    'похвала': ['похвалить', 'похвала', 'хвалить', 'одобрить']
  }

  // Основной метод анализа сообщения
  async analyzeMessage(
    userMessage: string,
    characterId: string,
    userId: string
  ): Promise<MessageAnalysis> {
    console.log('🚀 Начинаем анализ сообщения:', { userMessage, characterId, userId })

    const lowerMessage = userMessage.toLowerCase()

    // Базовый анализ
    const baseAnalysis = await this.performBaseAnalysis(userMessage)
    console.log('📊 Базовый анализ:', baseAnalysis)

    // Анализ команд поз
    const poseCommands = await this.analyzePoseCommands(lowerMessage, characterId)
    console.log('🎭 Команды поз:', poseCommands)

    // Анализ влияния на характеристики
    const characteristicInfluences = await this.analyzeCharacteristicInfluences(
      lowerMessage,
      characterId,
      userId
    )
    console.log('📈 Влияние на характеристики:', characteristicInfluences)

    // Анализ триггеров действий
    const actionTriggers = await this.analyzeActionTriggers(lowerMessage, characterId)
    console.log('⚡ Триггеры действий:', actionTriggers)

    // Анализ фетиш-элементов
    const fetishElements = await this.analyzeFetishElements(lowerMessage)
    console.log('🔥 Фетиш-элементы:', fetishElements)

    // Анализ изменений настроения
    const moodChanges = await this.analyzeMoodChanges(lowerMessage, characterId)
    console.log('😊 Изменения настроения:', moodChanges)

    const result = {
      ...baseAnalysis,
      poseCommands,
      characteristicInfluences,
      actionTriggers,
      fetishElements,
      moodChanges
    }

    console.log('✅ Анализ завершен:', result)
    return result
  }

  // Базовый анализ сообщения через Gemini
  private async performBaseAnalysis(userMessage: string) {
    const analysisPrompt = `
Ты эксперт по анализу сообщений в NSFW игре с BDSM элементами. Проанализируй сообщение пользователя и верни JSON с анализом.

СООБЩЕНИЕ: "${userMessage}"

ПРИМЕР ВАЛИДНОГО JSON:
{
  "intent": "compliment",
  "emotion": "curious",
  "keywords": ["чувствительная", "нежная", "приятно"],
  "sentiment": "positive",
  "complexity": 3,
  "urgency": 2,
  "requiresResponse": true,
  "suggestedActions": ["нежность", "забота"]
}

ВОЗМОЖНЫЕ ЗНАЧЕНИЯ:
- intent: greeting, question, request, compliment, complaint, story, statement, command, threat, seduction
- emotion: happy, sad, angry, fear, surprise, love, neutral, curious, excited, frustrated, confused, confident
- sentiment: positive, negative, neutral
- complexity: 1-10 (1=простое, 10=очень сложное)
- urgency: 1-10 (1=не срочно, 10=очень срочно)
- requiresResponse: true/false
- suggestedActions: массив возможных действий из списка: нежность, забота, грубость, насмешка, погладить, плеть, клиторальный модулятор, компрессионный пресс, нейронный осциллятор, ректо-анализатор

ПРАВИЛА АНАЛИЗА:
- Учитывай NSFW и BDSM тематику игры
- Анализируй подтекст и скрытые намерения
- Определяй эмоциональное состояние говорящего
- Выделяй ключевые слова, связанные с игровой механикой

ВЕРНИ ТОЛЬКО ВАЛИДНЫЙ JSON БЕЗ ДОПОЛНИТЕЛЬНОГО ТЕКСТА:
    `.trim()

    try {
      // Вызов Gemini для анализа
      const response = await this.callGeminiForAnalysis(analysisPrompt)
      return this.parseGeminiResponse(response)
    } catch (error) {
      console.error('Ошибка при анализе через Gemini:', error)
      // Fallback к базовым значениям
      return {
        intent: this.detectIntent(userMessage),
        emotion: this.detectEmotion(userMessage),
        keywords: this.extractKeywords(userMessage),
        sentiment: this.analyzeSentiment(userMessage),
        complexity: this.assessComplexity(userMessage),
        urgency: this.assessUrgency(userMessage),
        requiresResponse: true,
        suggestedActions: []
      }
    }
  }

  // Анализ команд поз
  private async analyzePoseCommands(
    message: string,
    characterId: string
  ): Promise<PoseCommand[]> {
    const commands: PoseCommand[] = []

    // Получаем доступные позы для персонажа
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        poses: {
          include: {
            definition: true
          }
        }
      }
    })

    if (!character) return commands

    // Проверяем каждую позу
    for (const pose of character.poses) {
      const poseName = pose.definition.name.toLowerCase()
      const confidence = this.calculatePoseConfidence(message, poseName)

      if (confidence > 0.2) { // Понизили порог с 0.3 до 0.2
        commands.push({
          poseName: pose.definition.name,
          confidence,
          isExplicit: confidence > 0.6, // Понизили порог с 0.7 до 0.6
          modifiers: this.extractPoseModifiers(message, poseName)
        })
      }
    }

    return commands.sort((a, b) => b.confidence - a.confidence)
  }

  // Анализ влияния на характеристики через Gemini
  private async analyzeCharacteristicInfluences(
    message: string,
    characterId: string,
    userId: string
  ): Promise<CharacteristicInfluence[]> {
    try {
      console.log('🔍 Начинаем анализ влияния на характеристики:', { message, characterId, userId })

      // Получаем характеристики персонажа
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
          characteristics: {
            include: {
              definition: true
            }
          }
        }
      })

      if (!character) {
        console.log('❌ Персонаж не найден:', characterId)
        return []
      }

      console.log('✅ Персонаж найден:', { name: character.name, characteristicsCount: character.characteristics.length })

      // Создаем промпт для анализа влияния на характеристики
      const characteristicsList = character.characteristics
        .map(c => `${c.definition.name}: ${c.currentValue}/${c.baseValue}`)
        .join(', ')

      console.log('📊 Характеристики персонажа:', characteristicsList)

      const analysisPrompt = `
Ты эксперт по анализу сообщений в NSFW игре с BDSM элементами. Проанализируй сообщение пользователя и определи, как оно может повлиять на характеристики персонажа.

СООБЩЕНИЕ: "${message}"

ХАРАКТЕРИСТИКИ ПЕРСОНАЖА: ${characteristicsList}

ДОСТУПНЫЕ ХАРАКТЕРИСТИКИ ДЛЯ ВОЗДЕЙСТВИЯ:
- Физические: Выносливость, Чувствительность, Гибкость, Эмоциональная стабильность, Адаптивность
- Психические: Интеллект, Общительность, Эмпатия, Доминантность, Самооценка, Оптимизм, Любопытство
- Сексуальные: Сексуальная опытность, Сопротивляемость, Зависимость, Усталость, Страх, Возбуждение, Боль
- Эмоциональные: Унижение, Стыд, Отчаяние, Гордость, Невинность, Покорность, Доминирование, Подчинение
- Фетиш-элементы: Садизм, Мазохизм, Унижение, Власть, Зависимость, Собственность, Сенсорная депривация, Сенсорная перегрузка, Щекотка, Вибрации, Фут-фетиш, Хенд-фетиш, Брест-фетиш, Анал-фетиш, Латекс/кожа, Резинки/верёвки, Страх, Стыд, Вина, Запретное, Беременность, Лактация, Менструация, Униформа, Статус, Возраст, Эдж-плей, Ограничение дыхания

ПРИМЕР ВАЛИДНОГО JSON:
{
  "characteristicInfluences": [
    {
      "characteristicName": "Чувствительность",
      "influence": 20,
      "confidence": 0.8,
      "reason": "Фраза 'ты очень чувствительная' напрямую указывает на эту характеристику",
      "isPermanent": false
    },
    {
      "characteristicName": "Эмпатия",
      "influence": 15,
      "confidence": 0.7,
      "reason": "Слова 'нежная' и 'хочу сделать тебе приятно' подразумевают заботу",
      "isPermanent": false
    }
  ]
}

ПРАВИЛА АНАЛИЗА:
- Положительные слова (хорошо, отлично, прекрасно, люблю, нравится) увеличивают характеристики
- Отрицательные слова (плохо, ужасно, ненавижу, не нравится) уменьшают характеристики
- Слова "всегда", "постоянно", "навсегда" делают изменения постоянными (isPermanent: true)
- Влияние должно быть в диапазоне -100 до +100
- Уверенность должна быть от 0 до 1
- Анализируй контекст и подтекст сообщения
- Учитывай NSFW и BDSM тематику игры

ВЕРНИ ТОЛЬКО ВАЛИДНЫЙ JSON БЕЗ ДОПОЛНИТЕЛЬНОГО ТЕКСТА:
      `.trim()

      console.log('🤖 Отправляем запрос к Gemini...')
      const response = await this.callGeminiForAnalysis(analysisPrompt)
      console.log('📥 Ответ от Gemini:', response)

      const analysis = this.parseGeminiResponse(response)
      console.log('📋 Анализ характеристик:', analysis)

      return analysis.characteristicInfluences || []
    } catch (error) {
      console.error('❌ Ошибка при анализе влияния на характеристики:', error)
      return []
    }
  }

  // Анализ триггеров действий
  private async analyzeActionTriggers(
    message: string,
    characterId: string
  ): Promise<ActionTrigger[]> {
    const triggers: ActionTrigger[] = []

    // Получаем доступные действия
    const actions = await prisma.action.findMany({
      where: { isActive: true }
    })

    for (const action of actions) {
      const actionName = action.name.toLowerCase()
      const confidence = this.calculateActionConfidence(message, actionName)

      if (confidence > 0.3) {
        triggers.push({
          actionName: action.name,
          confidence,
          intensity: this.extractIntensity(message),
          targetZone: this.extractTargetZone(message)
        })
      }
    }

    return triggers.sort((a, b) => b.confidence - a.confidence)
  }

  // Анализ фетиш-элементов
  private async analyzeFetishElements(message: string): Promise<FetishElement[]> {
    const elements: FetishElement[] = []

    for (const [type, keywords] of Object.entries(this.FETISH_KEYWORDS)) {
      const intensity = this.calculateFetishIntensity(message, keywords)
      const confidence = this.calculateFetishConfidence(message, keywords)

      if (confidence > 0.3) {
        elements.push({
          type,
          intensity,
          keywords: this.extractFetishKeywords(message, keywords),
          confidence
        })
      }
    }

    return elements.sort((a, b) => b.confidence - a.confidence)
  }

  // Анализ изменений настроения
  private async analyzeMoodChanges(
    message: string,
    characterId: string
  ): Promise<MoodChange[]> {
    const changes: MoodChange[] = []

    const moodTypes = ['радость', 'грусть', 'возбуждение', 'страх', 'гнев', 'спокойствие']

    for (const moodType of moodTypes) {
      const change = this.calculateMoodChange(message, moodType)
      const confidence = this.calculateMoodConfidence(message, moodType)

      if (Math.abs(change) > 5 && confidence > 0.3) {
        changes.push({
          moodType,
          change,
          confidence,
          trigger: this.extractMoodTrigger(message, moodType)
        })
      }
    }

    return changes
  }

  // Вспомогательные методы

  // Парсинг ответа Gemini (убираем markdown блоки)
  private parseGeminiResponse(response: string): any {
    try {
      // Убираем markdown блоки ```json и ```
      let cleanResponse = response.trim()

      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '')
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '')
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.replace(/\s*```$/, '')
      }

      return JSON.parse(cleanResponse)
    } catch (error) {
      console.error('Ошибка при парсинге ответа Gemini:', error)
      console.error('Ответ:', response)
      throw error
    }
  }

  // Вызов Gemini для анализа
  private async callGeminiForAnalysis(prompt: string): Promise<string> {
    try {
      // Импортируем fetch для Node.js
      const { default: fetch } = await import('node-fetch')

      const response = await fetch(process.env.OPENROUTER_BASE_URL + '/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'CYBERJACK v2.0'
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL_2 || 'google/gemini-2.5-flash-lite',
          messages: [
            {
              role: 'system',
              content: 'Ты эксперт по анализу сообщений. Отвечай только валидным JSON без дополнительного текста.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0]?.message?.content || '{}'
    } catch (error) {
      console.error('Ошибка при вызове Gemini:', error)
      throw error
    }
  }

  private calculatePoseConfidence(message: string, poseName: string): number {
    const lowerMessage = message.toLowerCase()
    const lowerPoseName = poseName.toLowerCase()
    let confidence = 0

    // Проверяем точное совпадение названия позы
    if (lowerMessage.includes(lowerPoseName)) {
      confidence += 0.6
    }

    // Проверяем ключевые слова для каждой позы
    const keywords = this.POSE_KEYWORDS[poseName as keyof typeof this.POSE_KEYWORDS] || []
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        confidence += 0.4
      }
    }

    // Проверяем общие команды поз
    if (lowerMessage.includes('позу') && lowerMessage.includes(lowerPoseName)) {
      confidence += 0.5
    }

    // Проверяем синонимы и связанные слова
    const synonyms = this.getPoseSynonyms(poseName)
    for (const synonym of synonyms) {
      if (lowerMessage.includes(synonym)) {
        confidence += 0.3
      }
    }

    return Math.min(1.0, confidence)
  }

  private getPoseSynonyms(poseName: string): string[] {
    const synonyms: { [key: string]: string[] } = {
      'стоя': ['встать', 'подняться', 'выпрямиться'],
      'сидя': ['сесть', 'присесть', 'усадить'],
      'лежа': ['лечь', 'прилечь', 'уложить'],
      'на коленях': ['колени', 'присесть на колени', 'встать на колени'],
      'распростертая': ['раскинуться', 'разложиться', 'распластаться'],
      'скрученная': ['скрутиться', 'свернуться', 'сжаться'],
      'доминирующая': ['доминировать', 'властвовать', 'командовать'],
      'покорная': ['покориться', 'подчиниться', 'смириться']
    }

    return synonyms[poseName] || []
  }

  private extractPoseModifiers(message: string, poseName: string): string[] {
    const modifiers: string[] = []
    const modifierKeywords = ['быстро', 'медленно', 'осторожно', 'грубо', 'нежно']

    for (const modifier of modifierKeywords) {
      if (message.includes(modifier)) {
        modifiers.push(modifier)
      }
    }

    return modifiers
  }

  // Удалено: старый метод анализа через ключевые слова заменен на AI анализ

  private calculateActionConfidence(message: string, actionName: string): number {
    const keywords = this.ACTION_KEYWORDS[actionName as keyof typeof this.ACTION_KEYWORDS] || []
    let confidence = 0

    for (const keyword of keywords) {
      if (message.includes(keyword)) {
        confidence += 0.4
      }
    }

    return Math.min(1.0, confidence)
  }

  private extractIntensity(message: string): number {
    const intensityWords = {
      'очень': 20,
      'сильно': 25,
      'слегка': 5,
      'немного': 5,
      'грубо': 30,
      'нежно': 10,
      'осторожно': 5
    }

    for (const [word, intensity] of Object.entries(intensityWords)) {
      if (message.includes(word)) {
        return intensity
      }
    }

    return 15 // Средняя интенсивность по умолчанию
  }

  private extractTargetZone(message: string): string | undefined {
    const zones = ['лицо', 'шея', 'грудь', 'живот', 'спина', 'руки', 'ноги', 'голова']

    for (const zone of zones) {
      if (message.includes(zone)) {
        return zone
      }
    }

    return undefined
  }

  private calculateFetishIntensity(message: string, keywords: string[]): number {
    let intensity = 0

    for (const keyword of keywords) {
      if (message.includes(keyword)) {
        intensity += 20
      }
    }

    // Дополнительные модификаторы интенсивности
    if (message.includes('очень') || message.includes('сильно')) {
      intensity *= 1.5
    }

    return Math.min(100, intensity)
  }

  private calculateFetishConfidence(message: string, keywords: string[]): number {
    let confidence = 0

    for (const keyword of keywords) {
      if (message.includes(keyword)) {
        confidence += 0.3
      }
    }

    return Math.min(1.0, confidence)
  }

  private extractFetishKeywords(message: string, keywords: string[]): string[] {
    return keywords.filter(keyword => message.includes(keyword))
  }

  private calculateMoodChange(message: string, moodType: string): number {
    const moodKeywords = {
      'радость': ['радость', 'счастье', 'веселье', 'рад', 'счастлив'],
      'грусть': ['грусть', 'печаль', 'тоска', 'грустно', 'печально'],
      'возбуждение': ['возбуждение', 'возбужден', 'возбуждает', 'страсть'],
      'страх': ['страх', 'боязнь', 'испуг', 'боюсь', 'страшно'],
      'гнев': ['гнев', 'злость', 'ярость', 'злой', 'сердитый'],
      'спокойствие': ['спокойствие', 'спокоен', 'умиротворение', 'тишина']
    }

    const keywords = moodKeywords[moodType as keyof typeof moodKeywords] || []
    let change = 0

    for (const keyword of keywords) {
      if (message.includes(keyword)) {
        change += 15
      }
    }

    return Math.max(-100, Math.min(100, change))
  }

  private calculateMoodConfidence(message: string, moodType: string): number {
    const moodKeywords = {
      'радость': ['радость', 'счастье', 'веселье', 'рад', 'счастлив'],
      'грусть': ['грусть', 'печаль', 'тоска', 'грустно', 'печально'],
      'возбуждение': ['возбуждение', 'возбужден', 'возбуждает', 'страсть'],
      'страх': ['страх', 'боязнь', 'испуг', 'боюсь', 'страшно'],
      'гнев': ['гнев', 'злость', 'ярость', 'злой', 'сердитый'],
      'спокойствие': ['спокойствие', 'спокоен', 'умиротворение', 'тишина']
    }

    const keywords = moodKeywords[moodType as keyof typeof moodKeywords] || []
    let confidence = 0

    for (const keyword of keywords) {
      if (message.includes(keyword)) {
        confidence += 0.3
      }
    }

    return Math.min(1.0, confidence)
  }

  private extractMoodTrigger(message: string, moodType: string): string {
    // Извлекаем контекст вокруг ключевых слов настроения
    const moodKeywords = {
      'радость': ['радость', 'счастье', 'веселье', 'рад', 'счастлив'],
      'грусть': ['грусть', 'печаль', 'тоска', 'грустно', 'печально'],
      'возбуждение': ['возбуждение', 'возбужден', 'возбуждает', 'страсть'],
      'страх': ['страх', 'боязнь', 'испуг', 'боюсь', 'страшно'],
      'гнев': ['гнев', 'злость', 'ярость', 'злой', 'сердитый'],
      'спокойствие': ['спокойствие', 'спокоен', 'умиротворение', 'тишина']
    }

    const keywords = moodKeywords[moodType as keyof typeof moodKeywords] || []

    for (const keyword of keywords) {
      if (message.includes(keyword)) {
        return this.getContextAroundKeyword(message, keyword)
      }
    }

    return message.substring(0, 50) + '...'
  }

  private getContextAroundKeyword(message: string, keyword: string): string {
    const index = message.indexOf(keyword)
    if (index === -1) return ''

    const start = Math.max(0, index - 20)
    const end = Math.min(message.length, index + keyword.length + 20)

    return message.substring(start, end)
  }

  // Базовые методы анализа (из response-manager)
  private detectIntent(text: string): string {
    const intents = {
      question: ['?', 'что', 'как', 'почему', 'когда', 'где', 'кто'],
      request: ['пожалуйста', 'можно', 'дай', 'покажи', 'сделай'],
      greeting: ['привет', 'здравствуй', 'добро пожаловать', 'hi', 'hello'],
      goodbye: ['пока', 'до свидания', 'увидимся', 'bye', 'goodbye'],
      compliment: ['красиво', 'хорошо', 'отлично', 'молодец', 'умница'],
      complaint: ['плохо', 'ужасно', 'не нравится', 'не люблю', 'ненавижу'],
      story: ['расскажи', 'история', 'было', 'случилось', 'произошло']
    }

    const lowerText = text.toLowerCase()

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return intent
      }
    }

    return 'statement'
  }

  private detectEmotion(text: string): string {
    const emotions = {
      happy: ['радость', 'счастье', 'веселье', 'улыбка', 'смех', 'рад', 'счастлив'],
      sad: ['грусть', 'печаль', 'тоска', 'грустно', 'печально', 'плач'],
      angry: ['злость', 'гнев', 'ярость', 'злой', 'сердитый', 'бешенство'],
      fear: ['страх', 'боязнь', 'испуг', 'боюсь', 'страшно', 'ужас'],
      surprise: ['удивление', 'шок', 'неожиданно', 'удивительно', 'внезапно'],
      love: ['любовь', 'люблю', 'обожаю', 'привязанность', 'нежность'],
      neutral: ['нормально', 'обычно', 'так себе', 'ничего особенного']
    }

    const lowerText = text.toLowerCase()

    for (const [emotion, keywords] of Object.entries(emotions)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return emotion
      }
    }

    return 'neutral'
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)

    const stopWords = ['это', 'что', 'как', 'где', 'когда', 'почему', 'кто', 'который', 'которая', 'которое']
    const keywords = words.filter(word => !stopWords.includes(word))

    return [...new Set(keywords)].slice(0, 10)
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['хорошо', 'отлично', 'прекрасно', 'замечательно', 'люблю', 'нравится', 'рад', 'счастлив']
    const negativeWords = ['плохо', 'ужасно', 'ненавижу', 'не нравится', 'грустно', 'злой', 'сердитый']

    const lowerText = text.toLowerCase()

    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length

    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  private assessComplexity(text: string): number {
    const words = text.split(/\s+/).length
    const sentences = text.split(/[.!?]+/).length
    const avgWordsPerSentence = words / sentences

    if (avgWordsPerSentence > 15) return 8
    if (avgWordsPerSentence > 10) return 6
    if (avgWordsPerSentence > 5) return 4
    return 2
  }

  private assessUrgency(text: string): number {
    const urgentWords = ['срочно', 'быстро', 'немедленно', 'сейчас', 'прямо сейчас']
    const lowerText = text.toLowerCase()

    for (const word of urgentWords) {
      if (lowerText.includes(word)) {
        return 8
      }
    }

    if (text.includes('!')) return 6
    if (text.includes('?')) return 4
    return 2
  }
}
