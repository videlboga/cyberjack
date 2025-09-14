// lib/core/time/time-system.ts

import { CharacteristicsSystem } from '../characteristics/characteristics-system'
import { PoseFormulaSystem } from '../poses/pose-formula-system'
import { ActivePosesSystem } from '../poses/active-poses-system'
import { AutoPoseSystem } from '../poses/auto-pose-system'

export class TimeSystem {
  private static instance: TimeSystem
  private gameTime: number = 0 // минуты игрового времени
  private lastUpdate: number = Date.now()
  private isRunning: boolean = false
  private actionHoldStart: number | null = null
  private recoveryInterval: NodeJS.Timeout | null = null

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
    this.startRecoveryTimer()
  }

  // Остановить холд действия
  stopActionHold(): void {
    this.actionHoldStart = null
    this.isRunning = false
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
  async advanceTime(minutes: number): Promise<void> {
    this.gameTime += minutes

    // Запустить восстановление для каждого шага
    for (let i = 0; i < minutes; i++) {
      await this.triggerRecovery()
    }
  }

  // Запустить восстановление характеристик
  private async triggerRecovery(): Promise<void> {
    try {
      const characteristicsSystem = new CharacteristicsSystem()
      const poseFormulaSystem = new PoseFormulaSystem()
      const activePosesSystem = ActivePosesSystem.getInstance()
      const autoPoseSystem = AutoPoseSystem.getInstance()

      // Получить всех персонажей
      const characters = await this.getAllCharacters()

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

      // Проверить и применить автоматические позы
      await autoPoseSystem.checkAndApplyAutoPoses()

      console.log(`Время обновлено: ${this.getFormattedTime()}`)
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

  // Получить состояние системы времени
  getState() {
    return {
      gameTime: this.gameTime,
      formattedTime: this.getFormattedTime(),
      isRunning: this.isRunning,
      actionHoldStart: this.actionHoldStart ? new Date(this.actionHoldStart) : null,
      lastUpdate: new Date(this.lastUpdate)
    }
  }

  // Сбросить время
  reset(): void {
    this.gameTime = 0
    this.lastUpdate = Date.now()
    this.isRunning = false
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

  // Очистка ресурсов
  destroy(): void {
    this.stopRecoveryTimer()
    this.reset()
  }
}
