// lib/character/characteristic-interpreter.ts

import { serverLogger, LogCategory } from '@/lib/utils/server-logger'

export interface CharacteristicInterpretation {
  name: string
  currentValue: number
  baseValue: number
  interpretation: string
  behaviorGuidance: string
  isRecentChange: boolean
  changeAmount?: number
  priority: 'high' | 'medium' | 'low'
}

export interface CharacteristicSummary {
  dominantTraits: CharacteristicInterpretation[]
  recentChanges: CharacteristicInterpretation[]
  emotionalState: string
  behaviorGuidance: string
  overallMood: string
}

export class CharacteristicInterpreter {
  private readonly RECENT_CHANGE_THRESHOLD = 5 // Изменение больше 5 считается значительным
  private readonly HIGH_PRIORITY_THRESHOLD = 80 // Высокий приоритет для значений > 80
  private readonly LOW_PRIORITY_THRESHOLD = 20 // Низкий приоритет для значений < 20

  // Интерпретация одной характеристики
  interpretCharacteristic(
    name: string,
    currentValue: number,
    baseValue: number,
    recentChange?: number,
    category?: string
  ): CharacteristicInterpretation {
    const isRecentChange = Math.abs(recentChange || 0) >= this.RECENT_CHANGE_THRESHOLD
    const changeAmount = recentChange || 0

    // Определяем приоритет
    let priority: 'high' | 'medium' | 'low' = 'medium'
    if (currentValue >= this.HIGH_PRIORITY_THRESHOLD || currentValue <= this.LOW_PRIORITY_THRESHOLD || isRecentChange) {
      priority = 'high'
    } else if (currentValue >= 60 || currentValue <= 40) {
      priority = 'medium'
    } else {
      priority = 'low'
    }

    const interpretation = this.getCharacteristicInterpretation(name, currentValue, category)
    const behaviorGuidance = this.getBehaviorGuidance(name, currentValue, isRecentChange, changeAmount, category)

    return {
      name,
      currentValue,
      baseValue,
      interpretation,
      behaviorGuidance,
      isRecentChange,
      changeAmount,
      priority
    }
  }

  // Получение интерпретации характеристики
  private getCharacteristicInterpretation(name: string, value: number, category?: string): string {
    const interpretations: Record<string, (val: number) => string> = {
      // Физические характеристики
      'Выносливость': (val) => val >= 80 ? 'Очень выносливая, может выдерживать длительные нагрузки' :
                                 val >= 60 ? 'Хорошая выносливость' :
                                 val >= 40 ? 'Средняя выносливость' :
                                 val >= 20 ? 'Низкая выносливость, быстро устает' :
                                 'Очень слабая, быстро истощается',

      'Гибкость': (val) => val >= 80 ? 'Невероятно гибкая, может принимать сложные позы' :
                            val >= 60 ? 'Хорошая гибкость' :
                            val >= 40 ? 'Средняя гибкость' :
                            val >= 20 ? 'Скованная, ограниченная подвижность' :
                            'Очень жесткая, проблемы с подвижностью',

      'Чувствительность': (val) => val >= 80 ? 'Крайне чувствительная, реагирует на малейшие прикосновения' :
                                    val >= 60 ? 'Высокая чувствительность' :
                                    val >= 40 ? 'Средняя чувствительность' :
                                    val >= 20 ? 'Низкая чувствительность' :
                                    'Практически нечувствительная',

      // Эмоциональные характеристики
      'Стыд': (val) => val >= 80 ? 'Очень стыдливая, легко краснеет и смущается' :
                        val >= 60 ? 'Стыдливая' :
                        val >= 40 ? 'Умеренно стыдливая' :
                        val >= 20 ? 'Мало стыда' :
                        'Практически бесстыдная',

      'Унижение': (val) => val >= 80 ? 'Глубоко униженная, чувствует себя недостойной' :
                            val >= 60 ? 'Униженная' :
                            val >= 40 ? 'Умеренно униженная' :
                            val >= 20 ? 'Мало унижения' :
                            'Не чувствует унижения',

      'Отчаяние': (val) => val >= 80 ? 'В глубоком отчаянии, потеряла надежду' :
                            val >= 60 ? 'Отчаявшаяся' :
                            val >= 40 ? 'Умеренно отчаявшаяся' :
                            val >= 20 ? 'Мало отчаяния' :
                            'Не отчаивается',

      'Гордость': (val) => val >= 80 ? 'Очень гордая, высокое мнение о себе' :
                            val >= 60 ? 'Гордая' :
                            val >= 40 ? 'Умеренно гордая' :
                            val >= 20 ? 'Мало гордости' :
                            'Сломленная гордость',

      'Самооценка': (val) => val >= 80 ? 'Высокая самооценка, уверена в себе' :
                              val >= 60 ? 'Хорошая самооценка' :
                              val >= 40 ? 'Средняя самооценка' :
                              val >= 20 ? 'Низкая самооценка' :
                              'Очень низкая самооценка',

      // Сексуальные характеристики
      'Сексуальная опытность': (val) => val >= 80 ? 'Очень опытная, знает что делает' :
                                        val >= 60 ? 'Опытная' :
                                        val >= 40 ? 'Умеренно опытная' :
                                        val >= 20 ? 'Неопытная' :
                                        'Полностью невинная',

      'Невинность': (val) => val >= 80 ? 'Полностью невинная, чистая' :
                             val >= 60 ? 'В основном невинная' :
                             val >= 40 ? 'Умеренно невинная' :
                             val >= 20 ? 'Мало невинности' :
                             'Потеряла невинность',

      'Садизм': (val) => val >= 80 ? 'Очень садистичная, получает удовольствие от доминирования' :
                        val >= 60 ? 'Садистичная' :
                        val >= 40 ? 'Умеренно садистичная' :
                        val >= 20 ? 'Мало садизма' :
                        'Не садистичная',

      'Мазохизм': (val) => val >= 80 ? 'Очень мазохистичная, получает удовольствие от подчинения' :
                            val >= 60 ? 'Мазохистичная' :
                            val >= 40 ? 'Умеренно мазохистичная' :
                            val >= 20 ? 'Мало мазохизма' :
                            'Не мазохистичная',

      // Психологические характеристики
      'Интеллект': (val) => val >= 80 ? 'Очень умная, быстро соображает' :
                            val >= 60 ? 'Умная' :
                            val >= 40 ? 'Средний интеллект' :
                            val >= 20 ? 'Не очень умная' :
                            'Глупая',

      'Оптимизм': (val) => val >= 80 ? 'Очень оптимистичная, видит хорошее во всем' :
                            val >= 60 ? 'Оптимистичная' :
                            val >= 40 ? 'Умеренно оптимистичная' :
                            val >= 20 ? 'Пессимистичная' :
                            'Очень пессимистичная',

      'Адаптивность': (val) => val >= 80 ? 'Очень адаптивная, легко приспосабливается' :
                                val >= 60 ? 'Адаптивная' :
                                val >= 40 ? 'Умеренно адаптивная' :
                                val >= 20 ? 'Плохо адаптируется' :
                                'Очень ригидная',

      'Эмпатия': (val) => val >= 80 ? 'Очень эмпатичная, чувствует эмоции других' :
                            val >= 60 ? 'Эмпатичная' :
                            val >= 40 ? 'Умеренно эмпатичная' :
                            val >= 20 ? 'Мало эмпатии' :
                            'Не эмпатичная',

      // Социальные характеристики
      'Общительность': (val) => val >= 80 ? 'Очень общительная, легко заводит знакомства' :
                                 val >= 60 ? 'Общительная' :
                                 val >= 40 ? 'Умеренно общительная' :
                                 val >= 20 ? 'Замкнутая' :
                                 'Очень замкнутая',

      'Доверие': (val) => val >= 80 ? 'Очень доверчивая, легко доверяет людям' :
                        val >= 60 ? 'Доверчивая' :
                        val >= 40 ? 'Умеренно доверчивая' :
                        val >= 20 ? 'Подозрительная' :
                        'Очень подозрительная',

      'Любопытство': (val) => val >= 80 ? 'Очень любопытная, интересуется всем' :
                                val >= 60 ? 'Любопытная' :
                                val >= 40 ? 'Умеренно любопытная' :
                                val >= 20 ? 'Мало любопытства' :
                                'Не любопытная',

      // Состояние
      'Настроение': (val) => val >= 80 ? 'Отличное настроение, очень довольна' :
                             val >= 60 ? 'Хорошее настроение' :
                             val >= 40 ? 'Нейтральное настроение' :
                             val >= 20 ? 'Плохое настроение' :
                             'Очень плохое настроение',

      'Стресс': (val) => val >= 80 ? 'Очень стрессовая, на грани срыва' :
                        val >= 60 ? 'Стрессовая' :
                        val >= 40 ? 'Умеренно стрессовая' :
                        val >= 20 ? 'Мало стресса' :
                        'Спокойная',

      'Возбуждение': (val) => val >= 80 ? 'Очень возбужденная, не может думать ни о чем другом' :
                                val >= 60 ? 'Возбужденная' :
                                val >= 40 ? 'Умеренно возбужденная' :
                                val >= 20 ? 'Мало возбуждения' :
                                'Не возбуждена',

      'Энергия': (val) => val >= 80 ? 'Полна энергии, готова к действию' :
                           val >= 60 ? 'Много энергии' :
                           val >= 40 ? 'Средняя энергия' :
                           val >= 20 ? 'Мало энергии' :
                           'Очень устала',

      'Доминирование': (val) => val >= 80 ? 'Очень доминантная, любит контролировать' :
                                  val >= 60 ? 'Доминантная' :
                                  val >= 40 ? 'Умеренно доминантная' :
                                  val >= 20 ? 'Подчиняющаяся' :
                                  'Очень подчиняющаяся',

      'Покорность': (val) => val >= 80 ? 'Очень покорная, готова подчиняться' :
                               val >= 60 ? 'Покорная' :
                               val >= 40 ? 'Умеренно покорная' :
                               val >= 20 ? 'Мало покорности' :
                               'Не покорная'
    }

    // Если есть конкретная интерпретация для этой характеристики
    if (interpretations[name]) {
      return interpretations[name](value)
    }

    // Если нет конкретной интерпретации, создаем общую на основе категории и описания
    return this.createGenericInterpretation(name, value, category)
  }

  // Создание общей интерпретации на основе категории и описания
  private createGenericInterpretation(name: string, value: number, category?: string): string {
    const categoryInterpretations: Record<string, (val: number) => string> = {
      'Физические': (val) => {
        if (val >= 80) return `Очень высокий уровень ${name.toLowerCase()}`
        if (val >= 60) return `Высокий уровень ${name.toLowerCase()}`
        if (val >= 40) return `Средний уровень ${name.toLowerCase()}`
        if (val >= 20) return `Низкий уровень ${name.toLowerCase()}`
        return `Очень низкий уровень ${name.toLowerCase()}`
      },
      'Эмоциональные': (val) => {
        if (val >= 80) return `Очень сильные ${name.toLowerCase()}`
        if (val >= 60) return `Сильные ${name.toLowerCase()}`
        if (val >= 40) return `Умеренные ${name.toLowerCase()}`
        if (val >= 20) return `Слабые ${name.toLowerCase()}`
        return `Очень слабые ${name.toLowerCase()}`
      },
      'Сексуальные': (val) => {
        if (val >= 80) return `Очень выраженные ${name.toLowerCase()}`
        if (val >= 60) return `Выраженные ${name.toLowerCase()}`
        if (val >= 40) return `Умеренные ${name.toLowerCase()}`
        if (val >= 20) return `Слабые ${name.toLowerCase()}`
        return `Очень слабые ${name.toLowerCase()}`
      },
      'Психологические': (val) => {
        if (val >= 80) return `Очень развитые ${name.toLowerCase()}`
        if (val >= 60) return `Развитые ${name.toLowerCase()}`
        if (val >= 40) return `Средние ${name.toLowerCase()}`
        if (val >= 20) return `Слабые ${name.toLowerCase()}`
        return `Очень слабые ${name.toLowerCase()}`
      },
      'Социальные': (val) => {
        if (val >= 80) return `Очень выраженные ${name.toLowerCase()}`
        if (val >= 60) return `Выраженные ${name.toLowerCase()}`
        if (val >= 40) return `Умеренные ${name.toLowerCase()}`
        if (val >= 20) return `Слабые ${name.toLowerCase()}`
        return `Очень слабые ${name.toLowerCase()}`
      },
      'Состояние': (val) => {
        if (val >= 80) return `Очень высокое ${name.toLowerCase()}`
        if (val >= 60) return `Высокое ${name.toLowerCase()}`
        if (val >= 40) return `Среднее ${name.toLowerCase()}`
        if (val >= 20) return `Низкое ${name.toLowerCase()}`
        return `Очень низкое ${name.toLowerCase()}`
      }
    }

    if (category && categoryInterpretations[category]) {
      return categoryInterpretations[category](value)
    }

    // Если категория неизвестна, создаем общую интерпретацию
    if (value >= 80) return `Очень высокий уровень ${name.toLowerCase()}`
    if (value >= 60) return `Высокий уровень ${name.toLowerCase()}`
    if (value >= 40) return `Средний уровень ${name.toLowerCase()}`
    if (value >= 20) return `Низкий уровень ${name.toLowerCase()}`
    return `Очень низкий уровень ${name.toLowerCase()}`
  }

  // Получение руководства по поведению
  private getBehaviorGuidance(name: string, value: number, isRecentChange: boolean, changeAmount: number, category?: string): string {
    const guidance: Record<string, (val: number, changed: boolean, change: number) => string> = {
      // Физические характеристики
      'Выносливость': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более выносливой - может выдерживать длительные нагрузки'
        if (changed && change < 0) return 'Стала менее выносливой - быстро устает, нуждается в отдыхе'
        if (val >= 80) return 'Очень выносливая - может работать долго без усталости'
        if (val <= 20) return 'Очень слабая - быстро истощается, часто отдыхает'
        return 'Средняя выносливость - работает в обычном темпе'
      },

      'Гибкость': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более гибкой - легко принимает сложные позы'
        if (changed && change < 0) return 'Стала менее гибкой - движения стали скованными'
        if (val >= 80) return 'Невероятно гибкая - может принимать любые позы'
        if (val <= 20) return 'Очень жесткая - ограниченная подвижность'
        return 'Средняя гибкость - обычная подвижность'
      },

      'Чувствительность': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более чувствительной - реагирует на малейшие прикосновения'
        if (changed && change < 0) return 'Стала менее чувствительной - нужны более сильные стимулы'
        if (val >= 80) return 'Крайне чувствительная - реагирует на малейшие прикосновения'
        if (val <= 20) return 'Практически нечувствительная - нужны сильные стимулы'
        return 'Средняя чувствительность - обычные реакции на прикосновения'
      },

      // Эмоциональные характеристики
      'Стыд': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более стыдливой - избегает прямого взгляда, краснеет'
        if (changed && change < 0) return 'Стала менее стыдливой - более открыта и смела'
        if (val >= 80) return 'Очень стыдливая - избегает интимных тем, краснеет от смущения'
        if (val <= 20) return 'Практически бесстыдная - открыто говорит на любые темы'
        return 'Умеренно стыдливая - реагирует на интимные темы'
      },

      'Унижение': (val, changed, change) => {
        if (changed && change > 0) return 'Чувствует больше унижения - опускает голову, избегает взгляда'
        if (changed && change < 0) return 'Чувствует меньше унижения - поднимает голову, смотрит в глаза'
        if (val >= 80) return 'Глубоко унижена - ведет себя как недостойная, просит прощения'
        if (val <= 20) return 'Не чувствует унижения - держится с достоинством'
        return 'Умеренно унижена - иногда чувствует себя недостойной'
      },

      'Отчаяние': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более отчаявшейся - потеряла надежду, впала в уныние'
        if (changed && change < 0) return 'Стала менее отчаявшейся - появилась надежда, более оптимистична'
        if (val >= 80) return 'В глубоком отчаянии - потеряла всякую надежду'
        if (val <= 20) return 'Не отчаивается - сохраняет надежду и оптимизм'
        return 'Умеренно отчаявшаяся - иногда теряет надежду'
      },

      'Гордость': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более гордой - держит голову высоко, уверена в себе'
        if (changed && change < 0) return 'Стала менее гордой - опускает голову, сомневается в себе'
        if (val >= 80) return 'Очень гордая - высокомерна, не признает ошибок'
        if (val <= 20) return 'Сломленная гордость - не верит в себя'
        return 'Умеренно гордая - знает себе цену'
      },

      'Самооценка': (val, changed, change) => {
        if (changed && change > 0) return 'Самооценка выросла - стала увереннее в себе'
        if (changed && change < 0) return 'Самооценка упала - стала сомневаться в себе'
        if (val >= 80) return 'Высокая самооценка - уверена в себе и своих способностях'
        if (val <= 20) return 'Очень низкая самооценка - не верит в себя'
        return 'Средняя самооценка - обычная уверенность в себе'
      },

      // Сексуальные характеристики
      'Сексуальная опытность': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более опытной - знает что делает, уверена в действиях'
        if (changed && change < 0) return 'Стала менее опытной - неуверена, нуждается в руководстве'
        if (val >= 80) return 'Очень опытная - знает все тонкости, уверена в себе'
        if (val <= 20) return 'Полностью невинная - не знает что делать'
        return 'Умеренно опытная - знает основы'
      },

      'Невинность': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более невинной - чистая, наивная'
        if (changed && change < 0) return 'Стала менее невинной - более опытная, знающая'
        if (val >= 80) return 'Полностью невинная - чистая и наивная'
        if (val <= 20) return 'Потеряла невинность - опытная и знающая'
        return 'Умеренно невинная - частично опытная'
      },

      'Садизм': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более садистичной - получает удовольствие от доминирования'
        if (changed && change < 0) return 'Стала менее садистичной - более мягкая и добрая'
        if (val >= 80) return 'Очень садистичная - получает удовольствие от доминирования'
        if (val <= 20) return 'Не садистичная - добрая и мягкая'
        return 'Умеренно садистичная - иногда проявляет доминирование'
      },

      'Мазохизм': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более мазохистичной - получает удовольствие от подчинения'
        if (changed && change < 0) return 'Стала менее мазохистичной - более независимая'
        if (val >= 80) return 'Очень мазохистичная - получает удовольствие от подчинения'
        if (val <= 20) return 'Не мазохистичная - независимая и гордая'
        return 'Умеренно мазохистичная - иногда подчиняется'
      },

      // Психологические характеристики
      'Интеллект': (val, changed, change) => {
        if (changed && change > 0) return 'Стала умнее - быстрее соображает, лучше понимает'
        if (changed && change < 0) return 'Стала глупее - медленнее соображает, хуже понимает'
        if (val >= 80) return 'Очень умная - быстро соображает, все понимает'
        if (val <= 20) return 'Глупая - медленно соображает, плохо понимает'
        return 'Средний интеллект - обычное мышление'
      },

      'Оптимизм': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более оптимистичной - видит хорошее во всем'
        if (changed && change < 0) return 'Стала менее оптимистичной - видит плохое во всем'
        if (val >= 80) return 'Очень оптимистичная - видит хорошее во всем'
        if (val <= 20) return 'Очень пессимистичная - видит плохое во всем'
        return 'Умеренно оптимистичная - баланс между оптимизмом и пессимизмом'
      },

      'Адаптивность': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более адаптивной - легко приспосабливается к изменениям'
        if (changed && change < 0) return 'Стала менее адаптивной - плохо приспосабливается к изменениям'
        if (val >= 80) return 'Очень адаптивная - легко приспосабливается к любым изменениям'
        if (val <= 20) return 'Очень ригидная - плохо приспосабливается к изменениям'
        return 'Умеренно адаптивная - обычная приспособляемость'
      },

      'Эмпатия': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более эмпатичной - лучше чувствует эмоции других'
        if (changed && change < 0) return 'Стала менее эмпатичной - хуже чувствует эмоции других'
        if (val >= 80) return 'Очень эмпатичная - чувствует эмоции других'
        if (val <= 20) return 'Не эмпатичная - не чувствует эмоции других'
        return 'Умеренно эмпатичная - обычная способность к сопереживанию'
      },

      // Социальные характеристики
      'Общительность': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более общительной - легко заводит знакомства'
        if (changed && change < 0) return 'Стала менее общительной - избегает общения'
        if (val >= 80) return 'Очень общительная - легко заводит знакомства'
        if (val <= 20) return 'Очень замкнутая - избегает общения'
        return 'Умеренно общительная - обычная социальность'
      },

      'Доверие': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более доверчивой - легко доверяет людям'
        if (changed && change < 0) return 'Стала менее доверчивой - подозрительна к людям'
        if (val >= 80) return 'Очень доверчивая - легко доверяет людям'
        if (val <= 20) return 'Очень подозрительная - не доверяет людям'
        return 'Умеренно доверчивая - обычное доверие к людям'
      },

      'Любопытство': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более любопытной - интересуется всем'
        if (changed && change < 0) return 'Стала менее любопытной - мало что интересует'
        if (val >= 80) return 'Очень любопытная - интересуется всем'
        if (val <= 20) return 'Не любопытная - мало что интересует'
        return 'Умеренно любопытная - обычный интерес к окружающему'
      },

      // Состояние
      'Настроение': (val, changed, change) => {
        if (changed && change > 0) return 'Настроение улучшилось - улыбается, более дружелюбна'
        if (changed && change < 0) return 'Настроение ухудшилось - хмурится, менее дружелюбна'
        if (val >= 80) return 'Отличное настроение - очень позитивна и энергична'
        if (val <= 20) return 'Плохое настроение - грустна и апатична'
        return 'Нейтральное настроение - спокойна и уравновешена'
      },

      'Стресс': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более стрессовой - нервничает, не может расслабиться'
        if (changed && change < 0) return 'Стала менее стрессовой - успокоилась, расслабилась'
        if (val >= 80) return 'Очень стрессовая - на грани срыва, паникует'
        if (val <= 20) return 'Спокойная - расслаблена и беззаботна'
        return 'Умеренно стрессовая - немного нервничает'
      },

      'Возбуждение': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более возбужденной - тяжело дышит, не может сосредоточиться'
        if (changed && change < 0) return 'Стала менее возбужденной - успокоилась, может думать ясно'
        if (val >= 80) return 'Очень возбуждена - не может думать ни о чем другом'
        if (val <= 20) return 'Не возбуждена - спокойна и сосредоточена'
        return 'Умеренно возбуждена - чувствует легкое волнение'
      },

      'Энергия': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более энергичной - полна сил, готова к действию'
        if (changed && change < 0) return 'Стала менее энергичной - устала, нуждается в отдыхе'
        if (val >= 80) return 'Полна энергии - готова к любым действиям'
        if (val <= 20) return 'Очень устала - нуждается в отдыхе'
        return 'Средняя энергия - обычная активность'
      },

      'Доминирование': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более доминантной - любит контролировать ситуацию'
        if (changed && change < 0) return 'Стала менее доминантной - более подчиняющаяся'
        if (val >= 80) return 'Очень доминантная - любит контролировать'
        if (val <= 20) return 'Очень подчиняющаяся - готова подчиняться'
        return 'Умеренно доминантная - баланс между доминированием и подчинением'
      },

      'Покорность': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более покорной - готова подчиняться, ждет указаний'
        if (changed && change < 0) return 'Стала менее покорной - проявляет инициативу, сопротивляется'
        if (val >= 80) return 'Очень покорная - полностью подчиняется, не сопротивляется'
        if (val <= 20) return 'Не покорная - сопротивляется, проявляет характер'
        return 'Умеренно покорная - иногда подчиняется'
      },

      // Специальные состояния
      'Сенсорная депривация': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более депривированной - лишена сенсорных стимулов'
        if (changed && change < 0) return 'Стала менее депривированной - получает больше стимулов'
        if (val >= 80) return 'Полная сенсорная депривация - лишена всех стимулов'
        if (val <= 20) return 'Нет сенсорной депривации - получает все стимулы'
        return 'Умеренная сенсорная депривация - ограниченные стимулы'
      },

      'Сенсорная перегрузка': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более перегруженной - слишком много стимулов'
        if (changed && change < 0) return 'Стала менее перегруженной - стимулы в норме'
        if (val >= 80) return 'Полная сенсорная перегрузка - слишком много стимулов'
        if (val <= 20) return 'Нет сенсорной перегрузки - стимулы в норме'
        return 'Умеренная сенсорная перегрузка - немного много стимулов'
      },

      'Беременность': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более беременной - сильнее чувствует изменения'
        if (changed && change < 0) return 'Стала менее беременной - меньше чувствует изменения'
        if (val >= 80) return 'Полная беременность - сильно чувствует все изменения'
        if (val <= 20) return 'Нет беременности - не чувствует изменений'
        return 'Умеренная беременность - чувствует некоторые изменения'
      },

      'Лактация': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более лактирующей - сильнее чувствует изменения'
        if (changed && change < 0) return 'Стала менее лактирующей - меньше чувствует изменения'
        if (val >= 80) return 'Полная лактация - сильно чувствует все изменения'
        if (val <= 20) return 'Нет лактации - не чувствует изменений'
        return 'Умеренная лактация - чувствует некоторые изменения'
      },

      'Менструация': (val, changed, change) => {
        if (changed && change > 0) return 'Стала более менструирующей - сильнее чувствует изменения'
        if (changed && change < 0) return 'Стала менее менструирующей - меньше чувствует изменения'
        if (val >= 80) return 'Полная менструация - сильно чувствует все изменения'
        if (val <= 20) return 'Нет менструации - не чувствует изменений'
        return 'Умеренная менструация - чувствует некоторые изменения'
      }
    }

    // Если есть конкретное руководство для этой характеристики
    if (guidance[name]) {
      return guidance[name](value, isRecentChange, changeAmount)
    }

    // Если нет конкретного руководства, создаем общее на основе категории
    return this.createGenericBehaviorGuidance(name, value, isRecentChange, changeAmount, category)
  }

  // Создание общего руководства по поведению на основе категории
  private createGenericBehaviorGuidance(name: string, value: number, isRecentChange: boolean, changeAmount: number, category?: string): string {
    if (isRecentChange) {
      const changeText = changeAmount > 0 ? 'увеличилось' : 'уменьшилось'
      return `${name} ${changeText} - это влияет на поведение`
    }

    const categoryGuidance: Record<string, (val: number, name: string) => string> = {
      'Физические': (val, name) => {
        if (val >= 80) return `Высокий уровень ${name.toLowerCase()} влияет на физические возможности`
        if (val >= 60) return `Хороший уровень ${name.toLowerCase()} обеспечивает стабильность`
        if (val >= 40) return `Средний уровень ${name.toLowerCase()} - обычные возможности`
        if (val >= 20) return `Низкий уровень ${name.toLowerCase()} ограничивает возможности`
        return `Очень низкий уровень ${name.toLowerCase()} сильно ограничивает`
      },
      'Эмоциональные': (val, name) => {
        if (val >= 80) return `Сильные ${name.toLowerCase()} определяют эмоциональные реакции`
        if (val >= 60) return `Выраженные ${name.toLowerCase()} влияют на настроение`
        if (val >= 40) return `Умеренные ${name.toLowerCase()} - обычные эмоции`
        if (val >= 20) return `Слабые ${name.toLowerCase()} - мало влияют на эмоции`
        return `Очень слабые ${name.toLowerCase()} - практически не влияют`
      },
      'Сексуальные': (val, name) => {
        if (val >= 80) return `Выраженные ${name.toLowerCase()} влияют на сексуальное поведение`
        if (val >= 60) return `Заметные ${name.toLowerCase()} проявляются в интимности`
        if (val >= 40) return `Умеренные ${name.toLowerCase()} - обычное поведение`
        if (val >= 20) return `Слабые ${name.toLowerCase()} - мало влияют на поведение`
        return `Очень слабые ${name.toLowerCase()} - практически не проявляются`
      },
      'Психологические': (val, name) => {
        if (val >= 80) return `Развитые ${name.toLowerCase()} определяют мышление`
        if (val >= 60) return `Хорошие ${name.toLowerCase()} влияют на решения`
        if (val >= 40) return `Средние ${name.toLowerCase()} - обычное мышление`
        if (val >= 20) return `Слабые ${name.toLowerCase()} ограничивают мышление`
        return `Очень слабые ${name.toLowerCase()} сильно ограничивают`
      },
      'Социальные': (val, name) => {
        if (val >= 80) return `Выраженные ${name.toLowerCase()} определяют социальное поведение`
        if (val >= 60) return `Заметные ${name.toLowerCase()} влияют на общение`
        if (val >= 40) return `Умеренные ${name.toLowerCase()} - обычное общение`
        if (val >= 20) return `Слабые ${name.toLowerCase()} - мало влияют на общение`
        return `Очень слабые ${name.toLowerCase()} - практически не влияют`
      },
      'Состояние': (val, name) => {
        if (val >= 80) return `Высокое ${name.toLowerCase()} определяет общее состояние`
        if (val >= 60) return `Хорошее ${name.toLowerCase()} влияет на самочувствие`
        if (val >= 40) return `Среднее ${name.toLowerCase()} - обычное состояние`
        if (val >= 20) return `Низкое ${name.toLowerCase()} ухудшает состояние`
        return `Очень низкое ${name.toLowerCase()} сильно ухудшает`
      }
    }

    if (category && categoryGuidance[category]) {
      return categoryGuidance[category](value, name)
    }

    // Если категория неизвестна, создаем общее руководство
    if (value >= 80) return `Высокий уровень ${name.toLowerCase()} влияет на поведение`
    if (value >= 60) return `Хороший уровень ${name.toLowerCase()} обеспечивает стабильность`
    if (value >= 40) return `Средний уровень ${name.toLowerCase()} - обычное поведение`
    if (value >= 20) return `Низкий уровень ${name.toLowerCase()} ограничивает поведение`
    return `Очень низкий уровень ${name.toLowerCase()} сильно ограничивает`
  }

  // Создание сводки характеристик
  createCharacteristicSummary(
    characteristics: Array<{
      name: string
      category: string
      description?: string
      currentValue: number
      baseValue: number
      recentChange?: number
    }>
  ): CharacteristicSummary {
    serverLogger.info(LogCategory.AI, 'Создаем сводку характеристик', {
      totalCharacteristics: characteristics.length
    })

    // Фильтруем нулевые характеристики
    const nonZeroCharacteristics = characteristics.filter(char => char.currentValue > 0)

    serverLogger.debug(LogCategory.AI, 'Фильтрация нулевых характеристик', {
      totalCharacteristics: characteristics.length,
      nonZeroCharacteristics: nonZeroCharacteristics.length
    })

    const interpretations = nonZeroCharacteristics.map(char =>
      this.interpretCharacteristic(char.name, char.currentValue, char.baseValue, char.recentChange, char.category)
    )

    // Топ-5 характеристик с максимальными значениями
    const topTraits = interpretations
      .sort((a, b) => b.currentValue - a.currentValue)
      .slice(0, 5)

    // Топ-5 последних измененных характеристик
    const recentChanges = interpretations
      .filter(interp => interp.isRecentChange && Math.abs(interp.changeAmount || 0) >= 5)
      .sort((a, b) => Math.abs(b.changeAmount || 0) - Math.abs(a.changeAmount || 0))
      .slice(0, 5)

    // Эмоциональное состояние
    const emotionalState = this.determineEmotionalState(interpretations)

    // Общее руководство по поведению
    const behaviorGuidance = this.generateBehaviorGuidance(interpretations)

    // Общее настроение
    const overallMood = this.determineOverallMood(interpretations)

    serverLogger.debug(LogCategory.AI, 'Сводка характеристик создана', {
      topTraitsCount: topTraits.length,
      recentChangesCount: recentChanges.length,
      emotionalState,
      overallMood
    })

    return {
      dominantTraits: topTraits,
      recentChanges,
      emotionalState,
      behaviorGuidance,
      overallMood
    }
  }

  // Определение эмоционального состояния
  private determineEmotionalState(interpretations: CharacteristicInterpretation[]): string {
    const mood = interpretations.find(i => i.name === 'Настроение')
    const stress = interpretations.find(i => i.name === 'Стресс')
    const shame = interpretations.find(i => i.name === 'Стыд')
    const humiliation = interpretations.find(i => i.name === 'Унижение')

    if (mood && mood.currentValue >= 80) return 'очень позитивное'
    if (mood && mood.currentValue <= 20) return 'очень негативное'
    if (stress && stress.currentValue >= 80) return 'стрессовое'
    if (shame && shame.currentValue >= 80) return 'стыдливое'
    if (humiliation && humiliation.currentValue >= 80) return 'униженное'

    return 'нейтральное'
  }

  // Генерация руководства по поведению
  private generateBehaviorGuidance(interpretations: CharacteristicInterpretation[]): string {
    const highPriorityInterpretations = interpretations
      .filter(interp => interp.priority === 'high')
      .sort((a, b) => Math.abs(b.currentValue - 50) - Math.abs(a.currentValue - 50))

    if (highPriorityInterpretations.length === 0) {
      return 'Поведение в пределах нормы'
    }

    // Берем только самые важные характеристики (максимум 3)
    const topInterpretations = highPriorityInterpretations.slice(0, 3)

    // Убираем дублирующиеся фразы и создаем более читаемый текст
    const guidance = topInterpretations
      .map(interp => interp.behaviorGuidance)
      .filter((guidance, index, array) => array.indexOf(guidance) === index) // Убираем дубликаты
      .join('; ')

    return guidance || 'Поведение в пределах нормы'
  }

  // Определение общего настроения
  private determineOverallMood(interpretations: CharacteristicInterpretation[]): string {
    const mood = interpretations.find(i => i.name === 'Настроение')
    const optimism = interpretations.find(i => i.name === 'Оптимизм')
    const stress = interpretations.find(i => i.name === 'Стресс')

    if (mood && mood.currentValue >= 80) return 'отличное'
    if (mood && mood.currentValue <= 20) return 'плохое'
    if (optimism && optimism.currentValue >= 80) return 'оптимистичное'
    if (stress && stress.currentValue >= 80) return 'стрессовое'

    return 'стабильное'
  }

  // Интерпретация изменений характеристик в ощущения персонажа
  interpretCharacteristicChanges(effects: Array<{characteristicId: string, change: number, permanent: boolean}>): string {
    const sensations: string[] = []

    for (const effect of effects) {
      const sensation = this.getSensationFromChange(effect.characteristicId, effect.change)
      if (sensation) {
        sensations.push(sensation)
      }
    }

    if (sensations.length === 0) {
      return 'Ты чувствуешь, что что-то изменилось, но не можешь точно определить что.'
    }

    return sensations.join(' ')
  }

  // Новый метод для интерпретации изменений характеристик в понятные ощущения
  interpretCharacteristicChangesAsSensations(
    characteristics: Array<{
      name: string
      category: string
      currentValue: number
      baseValue: number
      recentChange?: number
    }>
  ): string[] {
    const sensations: string[] = []

    for (const char of characteristics) {
      if (char.recentChange && Math.abs(char.recentChange) >= 5) {
        const sensation = this.getSensationFromCharacteristicName(char.name, char.recentChange)
        if (sensation) {
          sensations.push(sensation)
        }
      }
    }

    return sensations
  }

  // Получение ощущения по названию характеристики
  private getSensationFromCharacteristicName(characteristicName: string, change: number): string | null {
    const sensationMap: Record<string, (change: number) => string | null> = {
      // Физические характеристики
      'Энергия': (change) => {
        if (change > 0) return 'Ты чувствуешь прилив энергии и бодрости.'
        if (change < 0) return 'Ты чувствуешь усталость и потерю сил.'
        return null
      },
      'Выносливость': (change) => {
        if (change > 0) return 'Ты чувствуешь, что стала более выносливой.'
        if (change < 0) return 'Ты чувствуешь, что стала менее выносливой.'
        return null
      },
      'Гибкость': (change) => {
        if (change > 0) return 'Ты чувствуешь, что тело стало более гибким.'
        if (change < 0) return 'Ты чувствуешь, что тело стало более жестким.'
        return null
      },
      'Чувствительность': (change) => {
        if (change > 0) return 'Ты чувствуешь, что стала более чувствительной к прикосновениям.'
        if (change < 0) return 'Ты чувствуешь, что стала менее чувствительной к прикосновениям.'
        return null
      },

      // Эмоциональные характеристики
      'Настроение': (change) => {
        if (change > 0) return 'Твое настроение улучшается, ты чувствуешь себя лучше.'
        if (change < 0) return 'Твое настроение ухудшается, ты чувствуешь грусть.'
        return null
      },
      'Стыд': (change) => {
        if (change > 0) return 'Ты чувствуешь усиливающееся чувство стыда.'
        if (change < 0) return 'Ты чувствуешь, что стыд отступает.'
        return null
      },
      'Унижение': (change) => {
        if (change > 0) return 'Ты чувствуешь усиливающееся чувство унижения.'
        if (change < 0) return 'Ты чувствуешь, что унижение отступает.'
        return null
      },
      'Отчаяние': (change) => {
        if (change > 0) return 'Ты чувствуешь усиливающееся отчаяние.'
        if (change < 0) return 'Ты чувствуешь, что отчаяние отступает.'
        return null
      },
      'Гордость': (change) => {
        if (change > 0) return 'Ты чувствуешь усиливающееся чувство гордости.'
        if (change < 0) return 'Ты чувствуешь, что гордость угасает.'
        return null
      },
      'Самооценка': (change) => {
        if (change > 0) return 'Ты чувствуешь, что самооценка растет.'
        if (change < 0) return 'Ты чувствуешь, что самооценка падает.'
        return null
      },

      // Сексуальные характеристики
      'Сексуальная опытность': (change) => {
        if (change > 0) return 'Ты чувствуешь, что стала более опытной.'
        if (change < 0) return 'Ты чувствуешь, что стала менее опытной.'
        return null
      },
      'Невинность': (change) => {
        if (change > 0) return 'Ты чувствуешь себя более невинной.'
        if (change < 0) return 'Ты чувствуешь, что невинность уходит.'
        return null
      },
      'Садизм': (change) => {
        if (change > 0) return 'Ты чувствуешь усиливающееся желание доминировать.'
        if (change < 0) return 'Ты чувствуешь, что желание доминировать ослабевает.'
        return null
      },
      'Мазохизм': (change) => {
        if (change > 0) return 'Ты чувствуешь усиливающееся желание подчиняться.'
        if (change < 0) return 'Ты чувствуешь, что желание подчиняться ослабевает.'
        return null
      },

      // Психологические характеристики
      'Интеллект': (change) => {
        if (change > 0) return 'Ты чувствуешь, что стала умнее.'
        if (change < 0) return 'Ты чувствуешь, что стала менее сообразительной.'
        return null
      },
      'Оптимизм': (change) => {
        if (change > 0) return 'Ты чувствуешь себя более оптимистичной.'
        if (change < 0) return 'Ты чувствуешь себя более пессимистичной.'
        return null
      },
      'Адаптивность': (change) => {
        if (change > 0) return 'Ты чувствуешь, что стала более адаптивной.'
        if (change < 0) return 'Ты чувствуешь, что стала менее адаптивной.'
        return null
      },
      'Эмпатия': (change) => {
        if (change > 0) return 'Ты чувствуешь, что стала более эмпатичной.'
        if (change < 0) return 'Ты чувствуешь, что стала менее эмпатичной.'
        return null
      },

      // Социальные характеристики
      'Общительность': (change) => {
        if (change > 0) return 'Ты чувствуешь себя более общительной.'
        if (change < 0) return 'Ты чувствуешь себя более замкнутой.'
        return null
      },
      'Доверие': (change) => {
        if (change > 0) return 'Ты чувствуешь себя более доверчивой.'
        if (change < 0) return 'Ты чувствуешь себя более подозрительной.'
        return null
      },
      'Любопытство': (change) => {
        if (change > 0) return 'Ты чувствуешь усиливающееся любопытство.'
        if (change < 0) return 'Ты чувствуешь, что любопытство угасает.'
        return null
      },

      // Состояние
      'Стресс': (change) => {
        if (change > 0) return 'Ты чувствуешь усиливающийся стресс.'
        if (change < 0) return 'Ты чувствуешь, что стресс отступает.'
        return null
      },
      'Возбуждение': (change) => {
        if (change > 0) return 'Ты чувствуешь усиливающееся возбуждение.'
        if (change < 0) return 'Ты чувствуешь, что возбуждение утихает.'
        return null
      },
      'Доминирование': (change) => {
        if (change > 0) return 'Ты чувствуешь усиливающееся желание доминировать.'
        if (change < 0) return 'Ты чувствуешь, что желание доминировать ослабевает.'
        return null
      },
      'Покорность': (change) => {
        if (change > 0) return 'Ты чувствуешь усиливающееся желание подчиняться.'
        if (change < 0) return 'Ты чувствуешь, что желание подчиняться ослабевает.'
        return null
      }
    }

    const sensationFunction = sensationMap[characteristicName]
    if (sensationFunction) {
      return sensationFunction(change)
    }

    return null
  }

  // Получение ощущения от изменения характеристики
  private getSensationFromChange(characteristicId: string, change: number): string | null {
    // Маппинг ID характеристик на их названия и ощущения
    const characteristicSensations: Record<string, (change: number) => string | null> = {
      // Физические характеристики
      'cmflkd2lz0000hxpy5ntyixuz': (change) => { // Энергия
        if (change > 0) return 'Ты чувствуешь прилив энергии и бодрости.'
        if (change < 0) return 'Ты чувствуешь усталость и потерю сил.'
        return null
      },
      'cmflkd2m50007hxpy1n96qoo9': (change) => { // Настроение
        if (change > 0) return 'Твое настроение улучшается, ты чувствуешь себя лучше.'
        if (change < 0) return 'Твое настроение ухудшается, ты чувствуешь грусть.'
        return null
      },
      'cmflkd2m50008hxpy1n96qooa': (change) => { // Выносливость
        if (change > 0) return 'Ты чувствуешь, что стала более выносливой.'
        if (change < 0) return 'Ты чувствуешь, что стала менее выносливой.'
        return null
      },
      'cmflkd2m50009hxpy1n96qoob': (change) => { // Гибкость
        if (change > 0) return 'Ты чувствуешь, что тело стало более гибким.'
        if (change < 0) return 'Ты чувствуешь, что тело стало более жестким.'
        return null
      },
      'cmflkd2m5000ahxpy1n96qooc': (change) => { // Чувствительность
        if (change > 0) return 'Ты чувствуешь, что стала более чувствительной к прикосновениям.'
        if (change < 0) return 'Ты чувствуешь, что стала менее чувствительной к прикосновениям.'
        return null
      },
      // Эмоциональные характеристики
      'cmflkd2m5000bhxpy1n96qood': (change) => { // Стыд
        if (change > 0) return 'Ты чувствуешь усиливающееся чувство стыда.'
        if (change < 0) return 'Ты чувствуешь, что стыд отступает.'
        return null
      },
      'cmflkd2m5000chxpy1n96qooe': (change) => { // Унижение
        if (change > 0) return 'Ты чувствуешь усиливающееся чувство унижения.'
        if (change < 0) return 'Ты чувствуешь, что унижение отступает.'
        return null
      },
      'cmflkd2m5000dhxpy1n96qoof': (change) => { // Отчаяние
        if (change > 0) return 'Ты чувствуешь усиливающееся отчаяние.'
        if (change < 0) return 'Ты чувствуешь, что отчаяние отступает.'
        return null
      },
      'cmflkd2m5000ehxpy1n96qoog': (change) => { // Гордость
        if (change > 0) return 'Ты чувствуешь усиливающееся чувство гордости.'
        if (change < 0) return 'Ты чувствуешь, что гордость угасает.'
        return null
      },
      'cmflkd2m5000fhxpy1n96qooh': (change) => { // Самооценка
        if (change > 0) return 'Ты чувствуешь, что самооценка растет.'
        if (change < 0) return 'Ты чувствуешь, что самооценка падает.'
        return null
      }
    }

    const sensationFunction = characteristicSensations[characteristicId]
    if (sensationFunction) {
      return sensationFunction(change)
    }

    return null
  }
}
