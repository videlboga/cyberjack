// lib/core/time/time-system.ts

import { prisma } from '@/lib/db/client'
import { CharacteristicsSystem } from '../characteristics/characteristics-system'
import { PoseFormulaSystem } from '../poses/pose-formula-system'
import { ActivePosesSystem } from '../poses/active-poses-system'
import { AutoPoseSystem } from '../poses/auto-pose-system'

export class TimeSystem {
  private static instance: TimeSystem
  private gameTime: number = 0 // минуты игрового времени
  private lastUpdate: number = Date.now()
  private running: boolean = false
  private actionHoldStart: number | null = null
  private recoveryInterval: NodeJS.Timeout | null = null

  static getInstance(): TimeSystem {
    if (!TimeSystem.instance) {
      TimeSystem.instance = new TimeSystem()
    }
    return TimeSystem.instance
  }

  // Получить текущее игровое время пользователя
  async getGameTime(userId: string): Promise<number> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { gameTime: true }
      })
      return user?.gameTime || 0
    } catch (error) {
      console.error('Error getting user game time:', error)
      return 0
    }
  }

  // Получить игровое время в читаемом формате
  async getFormattedTime(userId: string): Promise<string> {
    const gameTime = await this.getGameTime(userId)
    const hours = Math.floor(gameTime / 60)
    const minutes = gameTime % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Начать холд действия
  startActionHold(): void {
    this.actionHoldStart = Date.now()
    this.running = true
    this.startRecoveryTimer()
  }

  // Остановить холд действия
  stopActionHold(): void {
    this.actionHoldStart = null
    this.running = false
    this.stopRecoveryTimer()
  }

  // Запустить таймер восстановления
  private startRecoveryTimer(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval)
    }

    this.recoveryInterval = setInterval(() => {
      this.update()
    }, 1000) // каждую секунду
  }

  // Остановить таймер восстановления
  private stopRecoveryTimer(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval)
      this.recoveryInterval = null
    }
  }

  // Обновить время (вызывается каждую секунду при холде)
  update(): void {
    if (!this.running || !this.actionHoldStart) return

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

  // Ручное управление временем пользователя
  async advanceTime(userId: string, minutes: number): Promise<void> {
    try {
      // Проверяем, существует ли пользователь
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, gameTime: true }
      })

      if (!user) {
        console.error(`User with ID ${userId} not found`)
        throw new Error(`User with ID ${userId} not found`)
      }

      // Обновляем время в базе данных
      await prisma.user.update({
        where: { id: userId },
        data: {
          gameTime: {
            increment: minutes
          }
        }
      })

      console.log(`Time advanced for user ${userId}: +${minutes} minutes (new total: ${user.gameTime + minutes})`)

      // Запустить восстановление для каждого шага
      for (let i = 0; i < minutes; i++) {
        await this.triggerRecovery(userId)
      }
    } catch (error) {
      console.error('Error advancing user game time:', error)
      throw error
    }
  }

  // Запустить восстановление характеристик для пользователя
  private async triggerRecovery(userId: string): Promise<void> {
    try {
      const characteristicsSystem = new CharacteristicsSystem()
      const poseFormulaSystem = new PoseFormulaSystem()
      const activePosesSystem = ActivePosesSystem.getInstance()
      const autoPoseSystem = AutoPoseSystem.getInstance()

      // Получить всех персонажей пользователя
      const characters = await this.getUserCharacters(userId)

      for (const character of characters) {
        // Получить все характеристики персонажа
        const characteristics = await characteristicsSystem.getCharacterCharacteristics(character.id)

        for (const characteristic of characteristics) {
          // Восстановить к базовому значению
          await characteristicsSystem.recoverToBase(character.id, characteristic.characteristicDefId)

          // Проверить сдвиг базового значения
          await characteristicsSystem.checkBaseShift(character.id, characteristic.characteristicDefId)
        }

        // Применить эффекты активных поз
        await this.applyPoseEffects(character.id, poseFormulaSystem, activePosesSystem)
      }

      // Проверить и применить автоматические позы для пользователя
      await autoPoseSystem.checkAndApplyAutoPoses(userId)

      const formattedTime = await this.getFormattedTime(userId)
      console.log(`Время обновлено для пользователя ${userId}: ${formattedTime}`)
    } catch (error) {
      console.error('Ошибка при восстановлении характеристик:', error)
    }
  }

  // Применить эффекты активных поз
  private async applyPoseEffects(
    characterId: string,
    poseFormulaSystem: PoseFormulaSystem,
    activePosesSystem: ActivePosesSystem
  ): Promise<void> {
    try {
      // Получить активные позы персонажа
      const activePoses = await activePosesSystem.getActivePoses(characterId)

      for (const poseStatus of activePoses) {
        if (!poseStatus.isActive) continue

        // Применить эффекты позы (каждую минуту)
        const effectResults = await poseFormulaSystem.applyPoseEffects(
          poseStatus.poseId,
          characterId,
          'system' // системный пользователь для автоматических эффектов
        )

        // Логируем результаты применения эффектов
        if (effectResults.length > 0) {
          console.log(`Применены эффекты позы ${poseStatus.poseId} для персонажа ${characterId}:`,
            effectResults.map(r => `${r.target}: ${r.oldValue} → ${r.newValue}`).join(', '))
        }

        // Обновить длительность позы
        const newDuration = poseStatus.duration + 1
        await activePosesSystem.updatePoseDuration(characterId, poseStatus.poseId, newDuration)
      }
    } catch (error) {
      console.error(`Ошибка при применении эффектов поз для персонажа ${characterId}:`, error)
    }
  }

  // Получить всех персонажей
  private async getAllCharacters(): Promise<Array<{ id: string }>> {
    const { prisma } = await import('@/lib/db/client')
    return await prisma.character.findMany({
      where: { isActive: true },
      select: { id: true }
    })
  }

  // Проверить, запущена ли система
  isRunning(): boolean {
    return this.running
  }

  // Получить состояние системы времени (устаревший метод)
  getState() {
    return {
      gameTime: this.gameTime,
      formattedTime: this.getFormattedTimeLegacy(),
      isRunning: this.running,
      actionHoldStart: this.actionHoldStart ? new Date(this.actionHoldStart) : null,
      lastUpdate: new Date(this.lastUpdate)
    }
  }

  // Устаревший метод для обратной совместимости
  private getFormattedTimeLegacy(): string {
    const hours = Math.floor(this.gameTime / 60)
    const minutes = this.gameTime % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Сбросить время
  reset(): void {
    this.gameTime = 0
    this.lastUpdate = Date.now()
    this.running = false
    this.actionHoldStart = null
    this.stopRecoveryTimer()
  }

  // Установить время
  setTime(minutes: number): void {
    this.gameTime = Math.max(0, minutes)
    this.lastUpdate = Date.now()
  }

  // Проверить, активно ли действие
  isActionActive(): boolean {
    return this.isRunning && this.actionHoldStart !== null
  }

  // Получить время с начала действия
  getActionDuration(): number {
    if (!this.actionHoldStart) return 0
    return Math.floor((Date.now() - this.actionHoldStart) / 1000)
  }

  // Получить игровое время с начала действия
  getActionGameTime(): number {
    return this.getActionDuration() // 1 секунда реального времени = 1 минута игрового времени
  }

  // Получить персонажей пользователя
  private async getUserCharacters(userId: string) {
    try {
      const characterCopies = await prisma.characterCopy.findMany({
        where: { userId },
        include: {
          character: true
        }
      })
      return characterCopies.map(copy => copy.character)
    } catch (error) {
      console.error('Error getting user characters:', error)
      return []
    }
  }

  // Получить состояние системы времени для пользователя
  async getState(userId: string) {
    const gameTime = await this.getGameTime(userId)
    const formattedTime = await this.getFormattedTime(userId)

    return {
      gameTime,
      formattedTime,
      isRunning: this.running,
      actionHoldStart: this.actionHoldStart ? new Date(this.actionHoldStart) : null,
      lastUpdate: new Date(this.lastUpdate)
    }
  }

  // Сбросить время пользователя
  async resetUserTime(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { gameTime: 0 }
      })
    } catch (error) {
      console.error('Error resetting user game time:', error)
    }
  }

  // Очистка ресурсов
  destroy(): void {
    this.stopRecoveryTimer()
    this.reset()
  }
}
