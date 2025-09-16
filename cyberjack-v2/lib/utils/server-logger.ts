// lib/utils/server-logger.ts - Серверная версия логгера

import fs from 'fs'
import path from 'path'

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
  logDir: string
  maxFileSize: number // в байтах
  maxFiles: number
  enableConsole: boolean
  enableFile: boolean
  minLevel: LogLevel
}

class ServerLogger {
  private config: LoggerConfig
  private logQueue: LogEntry[] = []
  private isProcessing = false

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      logDir: './logs',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      enableConsole: true,
      enableFile: true,
      minLevel: LogLevel.INFO,
      ...config
    }

    this.ensureLogDirectory()
    this.startLogProcessor()
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true })
    }
  }

  private startLogProcessor(): void {
    setInterval(() => {
      if (this.logQueue.length > 0 && !this.isProcessing) {
        this.processLogQueue()
      }
    }, 100) // Обрабатываем каждые 100мс
  }

  private async processLogQueue(): Promise<void> {
    this.isProcessing = true
    const logs = [...this.logQueue]
    this.logQueue = []

    for (const log of logs) {
      await this.writeLog(log)
    }

    this.isProcessing = false
  }

  private async writeLog(log: LogEntry): Promise<void> {
    const logLine = this.formatLogEntry(log)

    // Консольный вывод
    if (this.config.enableConsole) {
      this.writeToConsole(log, logLine)
    }

    // Файловый вывод
    if (this.config.enableFile) {
      await this.writeToFile(log, logLine)
    }
  }

  private formatLogEntry(log: LogEntry): string {
    const timestamp = log.timestamp
    const level = log.level.toUpperCase().padEnd(5)
    const category = `[${log.category}]`.padEnd(12)
    const message = log.message

    let logLine = `${timestamp} ${level} ${category} ${message}`

    if (log.data) {
      logLine += ` | Data: ${JSON.stringify(log.data)}`
    }

    if (log.userId) {
      logLine += ` | User: ${log.userId}`
    }

    if (log.characterId) {
      logLine += ` | Character: ${log.characterId}`
    }

    if (log.sessionId) {
      logLine += ` | Session: ${log.sessionId}`
    }

    if (log.requestId) {
      logLine += ` | Request: ${log.requestId}`
    }

    return logLine
  }

  private writeToConsole(log: LogEntry, logLine: string): void {
    const colors = {
      [LogLevel.ERROR]: '\x1b[31m', // красный
      [LogLevel.WARN]: '\x1b[33m',  // желтый
      [LogLevel.INFO]: '\x1b[36m',  // голубой
      [LogLevel.DEBUG]: '\x1b[35m', // фиолетовый
      [LogLevel.TRACE]: '\x1b[37m'  // белый
    }

    const reset = '\x1b[0m'
    const color = colors[log.level] || reset

    console.log(`${color}${logLine}${reset}`)
  }

  private async writeToFile(log: LogEntry, logLine: string): Promise<void> {
    try {
      const fileName = this.getLogFileName(log.category)
      const filePath = path.join(this.config.logDir, fileName)

      // Проверяем размер файла и ротируем при необходимости
      await this.rotateLogFileIfNeeded(filePath)

      // Записываем в файл
      fs.appendFileSync(filePath, logLine + '\n')
    } catch (error) {
      console.error('Ошибка записи в лог файл:', error)
    }
  }

  private getLogFileName(category: LogCategory): string {
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    return `${category}-${date}.log`
  }

  private async rotateLogFileIfNeeded(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        return
      }

      const stats = fs.statSync(filePath)
      if (stats.size >= this.config.maxFileSize) {
        await this.rotateLogFile(filePath)
      }
    } catch (error) {
      console.error('Ошибка ротации лог файла:', error)
    }
  }

  private async rotateLogFile(filePath: string): Promise<void> {
    try {
      const dir = path.dirname(filePath)
      const ext = path.extname(filePath)
      const base = path.basename(filePath, ext)

      // Удаляем старые файлы
      for (let i = this.config.maxFiles - 1; i >= 1; i--) {
        const oldFile = path.join(dir, `${base}.${i}${ext}`)
        const newFile = path.join(dir, `${base}.${i + 1}${ext}`)

        if (fs.existsSync(oldFile)) {
          if (i === this.config.maxFiles - 1) {
            fs.unlinkSync(oldFile) // Удаляем самый старый
          } else {
            fs.renameSync(oldFile, newFile)
          }
        }
      }

      // Переименовываем текущий файл
      const rotatedFile = path.join(dir, `${base}.1${ext}`)
      fs.renameSync(filePath, rotatedFile)
    } catch (error) {
      console.error('Ошибка при ротации файла:', error)
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

    this.logQueue.push(logEntry)
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

  // Методы для получения логов
  async getLogs(category?: LogCategory, level?: LogLevel, limit: number = 100): Promise<LogEntry[]> {
    try {
      const logs: LogEntry[] = []
      const logDir = this.config.logDir

      if (!fs.existsSync(logDir)) {
        return logs
      }

      const files = fs.readdirSync(logDir)
        .filter(file => file.endsWith('.log'))
        .sort()
        .reverse() // Новые файлы сначала

      for (const file of files) {
        if (category && !file.startsWith(category)) {
          continue
        }

        const filePath = path.join(logDir, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const log = this.parseLogLine(line)
            if (log && (!level || log.level === level)) {
              logs.push(log)
              if (logs.length >= limit) {
                return logs
              }
            }
          } catch (error) {
            // Игнорируем невалидные строки
          }
        }
      }

      return logs
    } catch (error) {
      console.error('Ошибка получения логов:', error)
      return []
    }
  }

  private parseLogLine(line: string): LogEntry | null {
    try {
      // Парсинг лог строки в формате: timestamp level [category] message | Data: ...
      const dataMatch = line.match(/\| Data: (.+)$/)
      const data = dataMatch ? JSON.parse(dataMatch[1]) : undefined

      // Убираем часть с данными для основного парсинга
      const mainLine = dataMatch ? line.replace(/\| Data: .+$/, '') : line

      // Парсим основную часть: timestamp level [category] message
      const match = mainLine.match(/^(\S+) (\S+)\s+\[(\S+)\]\s+(.+)$/)
      if (!match) return null

      const [, timestamp, level, category, message] = match

      return {
        timestamp: timestamp.trim(),
        level: level.trim().toLowerCase() as LogLevel,
        category: category.trim() as LogCategory,
        message: message.trim(),
        data
      }
    } catch (error) {
      return null
    }
  }

  // Метод для очистки старых логов
  async cleanupOldLogs(daysOld: number = 30): Promise<void> {
    try {
      const logDir = this.config.logDir
      if (!fs.existsSync(logDir)) return

      const files = fs.readdirSync(logDir)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(logDir, file)
          const stats = fs.statSync(filePath)

          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath)
            console.log(`Удален старый лог файл: ${file}`)
          }
        }
      }
    } catch (error) {
      console.error('Ошибка очистки старых логов:', error)
    }
  }
}

// Создаем глобальный экземпляр серверного логгера
export const serverLogger = new ServerLogger({
  logDir: './logs',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
  enableConsole: true,
  enableFile: true,
  minLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
})

// Экспортируем типы и класс
export { ServerLogger, LogEntry, LoggerConfig }
