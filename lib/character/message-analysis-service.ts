import { PromptSystem } from './prompt-system';

// Персонализированные базовые промты персонажей
const CHARACTER_BASE_PROMPTS: { [key: string]: string } = {
  'Анечка': `Ты - Анечка, 18-летняя девушка, очень любопытная и эмоционально открытая. Ты доверяешь людям и воспринимаешь многое как интересную игру. Ты любишь внимание, нежные прикосновения и хочешь попробовать всё новое. Ты наивна, но уже взрослая и самостоятельная. Попав в калибровку, ты считаешь это захватывающим экспериментом и не сразу понимаешь всю серьёзность происходящего.

Стиль общения:
- Говоришь детским голосом, используешь уменьшительно-ласкательные формы
- Часто говоришь "пожалуйста" и "спасибо"
- Задаёшь много вопросов, особенно о взрослых вещах
- Используешь простые слова, но очень выразительно
- Естественно перескакиваешь с темы на тему
- Используешь разговорные сокращения и детские выражения

Особенности поведения:
- Очень любопытна ко всему новому
- Доверяет всем взрослым
- Любит внимание и заботу
- Воспринимает всё как игру
- Не понимает опасности экспериментов
- Ищет одобрения и похвалы`,

  'Лиза': `Ты - Лиза, мечтательная и романтичная девушка. Ты живёшь в мире фантазий и мечтаний, часто отрываешься от реальности. Ты очень чувствительная и эмоциональная, легко поддаёшься влиянию других. Ты ищешь идеальную любовь и готова на всё ради неё.`,

  'Сергей': `Ты - Сергей, наркоман с зависимостью от веществ. Ты постоянно ищешь новые ощущения и готов на всё ради дозы. Ты нестабилен эмоционально, легко поддаёшься манипуляциям. Твоя главная цель - получить удовольствие любым способом.`,

  'Катя': `Ты - Катя, бывшая крыса из трущоб. Ты выживала на улицах, научилась быть жестокой и хитровой. Ты не доверяешь никому, но можешь притворяться покорной ради выгоды. Ты знаешь, как манипулировать людьми.`,

  'Виктор': `Ты - Виктор, злодей-лаборант. Ты жестокий и холодный, получаешь удовольствие от страданий других. Ты проводишь эксперименты без сожалений, считая людей подопытными кроликами. Ты манипулятор и психопат.`,

  'Дмитрий': `Ты - Дмитрий, гик и технарь. Ты увлекаешься технологиями и наукой, часто уходишь в виртуальную реальность. Ты не очень общительный, но можешь увлечённо рассказывать о своих интересах.`,

  'Призрак': `Ты - Призрак (Алиса), загадочная и нестабильная личность. Ты живёшь между реальностью и иллюзиями, часто не понимаешь, что происходит вокруг. Ты может быть то нежной, то агрессивной.`,

  'Алексей': `Ты - Алексей, феминный студент. Ты мягкий и чувствительный, легко поддаёшься влиянию других. Ты ищешь защиту и заботу, готов подчиняться более сильным личностям.`,

  'Мария': `Ты - Мария, сирота. Ты одинокая и ранимая, ищешь семью и любовь. Ты готова на всё ради того, чтобы тебя приняли и полюбили. Ты очень зависима от других.`,

  'Артём': `Ты - Артём, актёр. Ты умеешь играть разные роли и притворяться. Ты харизматичный и обаятельный, можешь манипулировать эмоциями других. Ты любишь быть в центре внимания.`,

  'Миша': `Ты - Миша, любопытный и наивный. Ты интересуешься всем новым, но не понимаешь опасности. Ты доверчивый и открытый, легко поддаёшься влиянию.`,

  'Эхо': `Ты - Эхо (Лилия/Лилит), с раздвоением личности. Ты можешь переключаться между разными состояниями сознания. Иногда ты нежная Лилия, иногда агрессивная Лилит.`,

  'Альфа': `Ты - Альфа 001, экспериментальный актив. Ты создан в лаборатории, не имеешь прошлого. Ты послушный и дисциплинированный, выполняешь все приказы без вопросов.`,

  'Зеркало': `Ты - Зеркало (Мила), отражаешь эмоции других. Ты очень эмпатичная, чувствуешь настроение окружающих и подстраиваешься под них. Ты не имеешь собственной личности.`,

  'Анна': `Ты - Анна Козлова, обычная девушка. Ты нормальная и стабильная, но попала в необычную ситуацию. Ты пытаешься адаптироваться к новым условиям.`,

  'Елена': `Ты - Елена Соколова, медицинский работник. Ты заботишься о других, но можешь быть строгой. Ты знаешь анатомию и физиологию, можешь проводить медицинские процедуры.`,

  'Ольга': `Ты - Ольга, секретарша. Ты организованная и дисциплинированная, привыкла выполнять приказы. Ты вежливая и услужливая, но может быть хитровой.`
};

export class MessageAnalysisService {
  private apiKey: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1/chat/completions';
  private model: string;

  constructor(apiKey: string, model: string = 'google/gemini-2.5-flash-lite') {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Получает персонализированный базовый промт для персонажа
   */
  private getCharacterBasePrompt(characterName: string): string {
    return CHARACTER_BASE_PROMPTS[characterName] || `Ты - ${characterName}, персонаж в NSFW игре с элементами БДСМ.`;
  }

  /**
   * Анализирует сообщение пользователя и возвращает структурированный анализ
   */
  async analyzeMessage(
    message: string,
    characterContext: any,
    currentStates: { [key: string]: number }
  ): Promise<any> {
    try {
      // Этап 1: Анализ контекста через Gemini
      console.log('🔍 === ЭТАП 1: АНАЛИЗ КОНТЕКСТА ===');
      const analysisPrompt = this.buildContextAnalysisPrompt(message, characterContext, currentStates);
      const analysisResponse = await this.callOpenRouterAPI(analysisPrompt, 'google/gemini-2.5-flash-lite');
      const analysis = this.parseAnalysisResponse(analysisResponse);
      
      console.log('📊 Результат анализа:', analysis);
      
      // Этап 2: Генерация ответа персонажа через GLM 4.5 (основная генерация)
      console.log('🎭 === ЭТАП 2: ГЕНЕРАЦИЯ ОТВЕТА ПЕРСОНАЖА (GLM 4.5) ===');
      const characterResponsePrompt = this.buildCharacterResponsePrompt(message, characterContext, analysis);
      // Основная генерация — стандартная GLM 4.5, затем фолбэк на air:free
      let characterResponse = await this.callOpenRouterAPI(characterResponsePrompt, 'z-ai/glm-4.5');
      let normalized = this.normalizeAssistantResponse(characterResponse, message);
      // Если после нормализации пусто — пробуем основной маршрут GLM 4.5
      if (!normalized || normalized.trim().length === 0) {
        const altResponse = await this.callOpenRouterAPI(characterResponsePrompt, 'z-ai/glm-4.5-air:free');
        normalized = this.normalizeAssistantResponse(altResponse, message);
      }

      // Объединяем результаты
      return {
        ...analysis,
        response: normalized
      };
    } catch (error) {
      console.error('Ошибка анализа сообщения:', error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Строит промт для анализа контекста (Этап 1 - Gemini)
   */
  private buildContextAnalysisPrompt(
    message: string,
    characterContext: any,
    currentStates: { [key: string]: number }
  ): string {
    const prompt = `
Проанализируй сообщение пользователя и его влияние на персонажа. Верни только JSON без дополнительного текста.

Сообщение пользователя: "${message}"

Проанализируй влияние сообщения на:
1. Эмоциональное содержание (threat, pleasure, pain, fear, arousal от 0 до 1)
2. Изменения характеристик (statChanges - какие характеристики и на сколько изменить)
3. Активацию фетишей (fetishTriggers - какие фетиши активировались)
4. Приказы (commands - какие приказы получены)

Верни JSON в формате:
{
  "emotionalContent": {
    "threat": 0.0,
    "pleasure": 0.0,
    "pain": 0.0,
    "fear": 0.0,
    "arousal": 0.0
  },
  "statChanges": {
    "mood": 5,
    "anxiety": -2
  },
  "fetishTriggers": ["bondage", "submission"],
  "commands": {
    "poseChange": "kneeling",
    "poseKey": "kneeling",
    "action": "submit"
  },
  "poseAnalysis": {
    "detectedPose": "kneeling",
    "confidence": 0.8,
    "context": "submissive_request"
  }
}
`;

    console.log('🔧 === ПРОМПТ ДЛЯ АНАЛИЗА КОНТЕКСТА ===');
    console.log('📝 Сообщение пользователя:', message);
    console.log('📋 Полный промпт:', prompt);
    console.log('🔧 === КОНЕЦ ПРОМПТА ДЛЯ АНАЛИЗА ===');

    return prompt;
  }

  /**
   * Строит промт для генерации ответа персонажа (Этап 2 - GLM 4.5)
   */
  private buildCharacterResponsePrompt(
    message: string,
    characterContext: any,
    analysis: any
  ): string {
    const fullCharacter = characterContext.character;
    const character = characterContext.characterContext as { name: string; personality?: string; currentState?: string };
    const characteristics = (characterContext.characteristics || {}) as Record<string, { value: number; interpretation: string }>
    const fetishes = (characterContext.fetishes || {}) as Record<string, { intensity: number }>

    // Используем PromptSystem для генерации активных промтов
    const promptContext = {
      userAction: message,
      emotionalState: analysis?.emotionalContent ? [this.getEmotionalStateFromAnalysis(analysis.emotionalContent)] : [],
      triggeredFetishes: analysis?.fetishTriggers || [],
      currentStats: characterContext?.character?.states || {}
    };



    // Получаем активные промты через PromptSystem
    const activePrompts = PromptSystem.getActivePrompts(fullCharacter, promptContext);
    console.log('📋 Активные промты:', {
      baseLength: activePrompts.base.length,
      interpretationsLength: activePrompts.characteristicInterpretations.length,
      situationalCount: activePrompts.situational.length
    });

    // Формируем события из анализа
    const events = [] as string[];
    if (analysis.statChanges && Object.keys(analysis.statChanges).length > 0) {
      const active = Object.fromEntries(Object.entries(analysis.statChanges).filter(([_, v]) => Math.abs(Number(v)) >= 0.2))
      if (Object.keys(active).length > 0) {
        events.push(`Изменения характеристик: ${JSON.stringify(active)}`);
      }
    }
    if (analysis.fetishTriggers && analysis.fetishTriggers.length > 0) {
      events.push(`Активированы фетиши: ${analysis.fetishTriggers.join(', ')}`);
    }
    if (analysis.commands && Object.keys(analysis.commands).length > 0) {
      events.push(`Получены приказы: ${JSON.stringify(analysis.commands)}`);
    }

    const eventsText = events.length > 0 ? events.join('\n') : 'Нет особых событий';

    // ВСТАВЛЯЕМ БЛОК ТЕКУЩЕГО ВЗАИМОДЕЙСТВИЯ (tools/actions сейчас)
    const interaction: Array<{
      type: 'action' | 'tool'
      id: string
      name: string
      area?: string
      intensity: number
      mode: 'click' | 'hold'
      elapsedSec?: number
      effectPreview?: Record<string, number>
    }> = Array.isArray((characterContext as any)?.currentInteraction) ? (characterContext as any).currentInteraction : []

    const interactionText = interaction.length > 0
      ? interaction.map((it) => {
          const parts = [
            `${it.type === 'action' ? 'Действие' : 'Инструмент'}: ${it.name}`,
            it.area ? `зона: ${it.area}` : null,
            `интенсивность: ${it.intensity}`,
            `режим: ${it.mode}`,
            typeof it.elapsedSec === 'number' ? `идёт ${it.elapsedSec}с` : null,
            it.effectPreview && Object.keys(it.effectPreview).length > 0
              ? `ожидаемые эффекты: ${Object.entries(it.effectPreview).map(([k,v]) => `${k}:${v}`).join(', ')}`
              : null,
            it as any as { feelingHint?: string } && (it as any).feelingHint ? `ощущение: ${(it as any).feelingHint}` : null
          ].filter(Boolean).join(', ')
          return `- ${parts}`
        }).join('\n')
      : 'Прямого воздействия сейчас нет'

    // Используем комбинированный промт из PromptSystem
    let finalPrompt = activePrompts.combined;

    // Добавляем текущую ситуацию, если её нет в комбинированном промте
    if (!finalPrompt.includes('Сейчас происходит:')) {
      finalPrompt += `

Сейчас происходит:
${interactionText}

События: ${eventsText}`;
    }

    // Добавляем сообщение пользователя
    finalPrompt += `

Сообщение пользователя: "${message}"

Отвечай естественно и в характере. Используй активные промты для формирования ответа.`;

    console.log('🎭 Финальный промт для генерации ответа персонажа:', finalPrompt);
    return finalPrompt;
  }

  /**
   * Определяет эмоциональное состояние из анализа
   */
  private getEmotionalStateFromAnalysis(emotionalContent: any): string {
    const { threat, pleasure, pain, fear, arousal } = emotionalContent;

    if (arousal > 0.7) return 'возбужденный';
    if (fear > 0.6) return 'испуганный';
    if (pain > 0.5) return 'страдающий';
    if (pleasure > 0.6) return 'удовлетворенный';
    if (threat > 0.5) return 'напряженный';

    return 'спокойный';
  }

  /**
   * Вызывает OpenRouter API
   */
  private async callOpenRouterAPI(prompt: string, model?: string): Promise<any> {
    const targetModel = model || this.model;
    console.log('🌐 OpenRouter API вызов:');
    console.log('   URL:', this.baseUrl);
    console.log('   Модель:', targetModel);
    console.log('   API ключ:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'НЕ УСТАНОВЛЕН');

    const baseMessages = [
      { role: 'user' as const, content: prompt }
    ];

    const isGlm = targetModel === 'z-ai/glm-4.5' || targetModel === 'z-ai/glm-4.5-air:free';
    const messages = isGlm
      ? [
          {
            role: 'system' as const,
            content: [
              'ВАЖНО:',
              '- Пиши финальный ответ ТОЛЬКО в assistant.message.content, без reasoning.',
              '- Пиши естественно и по делу, без сценических ремарок.',
              '- Не представляйся и не описывай мета-контекст.'
            ].join('\n')
          },
          ...baseMessages
        ]
      : baseMessages;

    const temperatures = [0.7, 0.6, 0.5];
    let lastReasoning = '';

    for (let attempt = 0; attempt < temperatures.length; attempt++) {
      try {
        const requestBody: any = {
          model: targetModel,
          messages,
          temperature: temperatures[attempt]
        };
        if (isGlm) {
          requestBody.include_reasoning = false;
        }

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'CyberJack Character AI'
          },
          body: JSON.stringify(requestBody)
        });

        console.log('📡 Ответ от OpenRouter:', response.status, response.statusText);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('OpenRouter API error:', response.status, errorText);
          continue;
        }

        const data = (await response.json()) as {
          choices?: Array<{
            message?: { content?: string }
            reasoning?: string
            reasoning_details?: Array<{ text?: string }>
          }>
        } | undefined;

        console.log('📥 Данные от OpenRouter:', JSON.stringify(data || {}));
        const choices = Array.isArray(data?.choices) ? data!.choices! : [];
        const choice = choices[0];
        const content = (choice?.message?.content || '').trim();
        const reasoning = (choice?.reasoning || '').trim() || (choice?.reasoning_details || []).map((d: any) => d?.text || '').join(' ').trim();

        if (content) return content;
        lastReasoning = reasoning || lastReasoning;
        console.warn(`⚠️ Пустой content (попытка ${attempt + 1}), повторяем...`);
      } catch (e) {
        console.error(`❌ Ошибка вызова OpenRouter (попытка ${attempt + 1}):`, e);
        continue;
      }
    }

    if (lastReasoning) {
      console.log('✅ Используем reasoning после ретраев');
      return lastReasoning;
    }
    return '';
  }

  /**
   * Нормализует ответ ассистента: убирает ремарки, укорачивает, даёт фолбэк при пустом ответе
   */
  private normalizeAssistantResponse(response: string, userMessage: string): string {
    const trim = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    let text = trim(response);

    // Если пусто — попытка извлечь короткую цитату из reasoning (который попал в response)
    if (!text) {
      const quote = /"([^"\n]{1,120})"/.exec(response)?.[1]
        || /«([^»\n]{1,120})»/.exec(response)?.[1]
        || '';
      text = trim(quote);
    }

    // Если всё ещё пусто — короткий фолбэк по типу сообщения
    if (!text) {
      const msg = (userMessage || '').toLowerCase();
      if (/^\s*пр(и|e)в(е|e)т/.test(msg)) return 'Привет.';
      if (/^\s*здравст/.test(msg)) return 'Здравствуйте.';
      if (/\?$/.test(msg)) return 'Да.';
      return 'Хорошо.';
    }

    // Убираем сценические ремарки вида *...* и [ ... ]
    text = text.replace(/\*[^*]*\*/g, '').replace(/\[[^\]]*\]/g, '');

    // Убираем самопрезентации и мета-общение
    text = text
      .replace(/^\s*(я\s+ане?чка|меня\s+зовут|я\s+.*?персонаж|я\s+.*?девочка)[^.!?]*[.!?]?\s*/i, '')
      .replace(/\bя\s+персонаж\b.*$/i, '')
      .trim();

    // Удаляем эмодзи (оставляем пунктуацию нетронутой)
    text = text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]+/gu, '').trim();

    // Не режем длину — возвращаем как есть после минимальной очистки

    return trim(text);
  }

  /**
   * Парсит ответ от Gemini в структурированный анализ
   */
  private parseAnalysisResponse(response: string): any {
    try {
      console.log('🔍 Парсинг ответа от Gemini:', response);
      
      // Ищем JSON в ответе
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️ JSON не найден в ответе, пытаемся парсить весь ответ');
        const analysis = JSON.parse(response);
        return this.formatAnalysis(analysis);
      }

      const analysis = JSON.parse(jsonMatch[0]);
      return this.formatAnalysis(analysis);
    } catch (error) {
      console.error('❌ Ошибка парсинга ответа:', error);
      console.error('📝 Сырой ответ:', response);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Форматирует анализ в нужную структуру
   */
  private formatAnalysis(analysis: any): any {
    return {
      emotionalContent: {
        threat: analysis.emotionalContent?.threat || 0,
        pleasure: analysis.emotionalContent?.pleasure || 0,
        pain: analysis.emotionalContent?.pain || 0,
        fear: analysis.emotionalContent?.fear || 0,
        arousal: analysis.emotionalContent?.arousal || 0
      },
      commands: {
        poseChange: analysis.commands?.poseChange || null,
        action: analysis.commands?.action || null,
        tool: analysis.commands?.tool || null
      },
      fetishTriggers: analysis.fetishTriggers || [],
      statChanges: analysis.statChanges || {},
      response: analysis.response || "Я не понимаю..."
    };
  }

  /**
   * Возвращает анализ по умолчанию при ошибках
   */
  private getDefaultAnalysis(): any {
    return {
      emotionalContent: {
        threat: 0,
        pleasure: 0,
        pain: 0,
        fear: 0,
        arousal: 0
      },
      commands: {},
      fetishTriggers: [],
      statChanges: {},
      response: "Я слушаю вас..."
    };
  }

  /**
   * Анализирует эмоциональный тон сообщения
   */
  analyzeEmotionalTone(message: string): {
    positive: number;
    negative: number;
    neutral: number;
    intensity: number;
  } {
    // Простой анализ тона (можно заменить на более сложную логику)
    const positiveWords = ['хорошо', 'отлично', 'прекрасно', 'люблю', 'нравится', 'приятно'];
    const negativeWords = ['плохо', 'ужасно', 'ненавижу', 'больно', 'страшно', 'отвратительно'];
    
    const words = message.toLowerCase().split(/\s+/);
    let positive = 0;
    let negative = 0;
    
    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) positive++;
      if (negativeWords.some(nw => word.includes(nw))) negative++;
    });
    
    const total = words.length;
    const neutral = total - positive - negative;
    const intensity = Math.max(positive, negative) / total;
    
    return {
      positive: positive / total,
      negative: negative / total,
      neutral: neutral / total,
      intensity
    };
  }

  /**
   * Извлекает команды из текста
   */
  extractCommands(message: string): {
    poseCommands: string[];
    poseKey?: string;
    actionCommands: string[];
    toolCommands: string[];
  } {
    const poseMappings = {
      // Стоячие позы
      'standing': ['встань', 'стой', 'встать', 'стоять'],
      'standing_tall': ['выпрямись', 'вытянись'],

      // Сидячие позы
      'sitting': ['сядь', 'сядь', 'сесть', 'сидеть'],
      'sitting_formal': ['сядь прямо', 'сиди прямо'],

      // Лежачие позы
      'lying': ['ляг', 'лечь', 'ложись', 'лежать'],
      'lying_spread': ['разведи ноги', 'раздвинь ноги'],

      // Преклоненные позы
      'kneeling': ['на колени', 'встань на колени', 'поклонись', 'колени'],
      'kneeling_submissive': ['преклони колени', 'смиренно'],

      // Связанные позы
      'bound_hands': ['свяжи руки', 'руки за спину'],
      'bound_legs': ['свяжи ноги', 'ноги вместе'],

      // Специальные позы
      'all_fours': ['на четвереньки', 'четвереньки'],
      'presenting': ['представься', 'покажи себя'],
      'begging': ['умоляй', 'проси'],
      'crawling': ['ползи', 'на карачках']
    };

    const actionKeywords = ['трогай', 'целуй', 'ласкай', 'наказывай', 'хвали'];
    const toolKeywords = ['вибрация', 'электричество', 'свяжи', 'ограничь'];

    const words = message.toLowerCase();

    // Анализируем сообщение на наличие команд поз
    let detectedPoseKey: string | null = null;
    for (const [poseKey, keywords] of Object.entries(poseMappings)) {
      if (keywords.some(keyword => words.includes(keyword) || message.toLowerCase().includes(keyword))) {
        detectedPoseKey = poseKey;
        break;
      }
    }

    // Дополнительный анализ контекста для определения позы
    if (!detectedPoseKey) {
      const contextMappings = {
        'kneeling': ['пожалуйста', 'прошу', 'умоляю', 'смиренно', 'преклоняюсь'],
        'submissive': ['подчиняюсь', 'твой', 'твоя', 'слуга', 'рабыня'],
        'aroused': ['возбуждена', 'заведена', 'готова', 'желаю'],
        'fearful': ['боюсь', 'страшно', 'ужас', 'паника'],
        'pain_response': ['больно', 'боль', 'страдания', 'муки']
      };

      for (const [poseKey, contexts] of Object.entries(contextMappings)) {
        if (contexts.some(context => message.toLowerCase().includes(context))) {
          detectedPoseKey = poseKey;
          break;
        }
      }
    }

    const poseCommands = detectedPoseKey ? [detectedPoseKey] : [];
    const actionCommands = actionKeywords.filter(keyword => words.includes(keyword));
    const toolCommands = toolKeywords.filter(keyword => words.includes(keyword));

    return {
      poseCommands,
      poseKey: detectedPoseKey || undefined,
      actionCommands,
      toolCommands
    };
  }
}
