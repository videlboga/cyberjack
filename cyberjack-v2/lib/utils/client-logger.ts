// lib/utils/client-logger.ts - Клиентская версия логгера

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

export enum LogCategory {
  SYSTEM = 'system',
  AI = 'ai',
  ACTIONS = 'actions',
  CHARACTERISTICS = 'characteristics',
  MEMORY = 'memory',
  CHAT = 'chat',
  API = 'api',
  DATABASE = 'database',
  AUTH = 'auth',
  GAME = 'game'
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  category: LogCategory
  message: string
  data?: any
  userId?: string
  characterId?: string
  sessionId?: string
  requestId?: string
}

interface LoggerConfig {
  enableConsole: boolean
  minLevel: LogLevel
}

class ClientLogger {
  private config: LoggerConfig

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      enableConsole: true,
      minLevel: LogLevel.INFO,
      ...config
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE]
    const minLevelIndex = levels.indexOf(this.config.minLevel)
    const currentLevelIndex = levels.indexOf(level)

    return currentLevelIndex <= minLevelIndex
  }

  private log(level: LogLevel, category: LogCategory, message: string, data?: any, context?: {
    userId?: string
    characterId?: string
    sessionId?: string
    requestId?: string
  }): void {
    if (!this.shouldLog(level)) {
      return
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      ...context
    }

    // Консольный вывод
    if (this.config.enableConsole) {
      this.writeToConsole(logEntry)
    }

    // Отправляем на сервер через API
    this.sendToServer(logEntry)
  }

  private writeToConsole(log: LogEntry): void {
    const colors = {
      [LogLevel.ERROR]: 'color: #dc2626', // красный
      [LogLevel.WARN]: 'color: #d97706',  // оранжевый
      [LogLevel.INFO]: 'color: #2563eb',  // синий
      [LogLevel.DEBUG]: 'color: #7c3aed', // фиолетовый
      [LogLevel.TRACE]: 'color: #6b7280'  // серый
    }

    const color = colors[log.level] || 'color: #6b7280'
    const timestamp = new Date(log.timestamp).toLocaleTimeString()
    
    console.log(
      `%c[${timestamp}] %c${log.level.toUpperCase()} %c[${log.category}] %c${log.message}`,
      'color: #6b7280',
      color,
      'color: #374151',
      'color: #111827',
      log.data ? log.data : ''
    )
  }

  private async sendToServer(log: LogEntry): Promise<void> {
    try {
      // Отправляем лог на сервер через API
      await fetch('/api/admin/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log)
      })
    } catch (error) {
      // Игнорируем ошибки отправки на сервер
      console.debug('Не удалось отправить лог на сервер:', error)
    }
  }

  // Публичные методы для разных уровней логирования
  error(category: LogCategory, message: string, data?: any, context?: any): void {
    this.log(LogLevel.ERROR, category, message, data, context)
  }

  warn(category: LogCategory, message: string, data?: any, context?: any): void {
    this.log(LogLevel.WARN, category, message, data, context)
  }

  info(category: LogCategory, message: string, data?: any, context?: any): void {
    this.log(LogLevel.INFO, category, message, data, context)
  }

  debug(category: LogCategory, message: string, data?: any, context?: any): void {
    this.log(LogLevel.DEBUG, category, message, data, context)
  }

  trace(category: LogCategory, message: string, data?: any, context?: any): void {
    this.log(LogLevel.TRACE, category, message, data, context)
  }
}

// Создаем глобальный экземпляр клиентского логгера
export const clientLogger = new ClientLogger({
  enableConsole: true,
  minLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
})

// Экспортируем типы и класс
export { ClientLogger, LogEntry, LoggerConfig }
