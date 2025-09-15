// __tests__/unit/time-system.test.ts

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { TimeSystem } from '@/lib/core/time/time-system'

describe('TimeSystem', () => {
  let timeSystem: TimeSystem

  beforeEach(() => {
    timeSystem = TimeSystem.getInstance()
    // Сбрасываем состояние
    timeSystem.stopActionHold()
  })

  afterEach(() => {
    timeSystem.stopActionHold()
  })

  describe('Singleton pattern', () => {
    test('should return same instance', () => {
      const instance1 = TimeSystem.getInstance()
      const instance2 = TimeSystem.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Game time management', () => {
    test('should start with zero game time', () => {
      expect(timeSystem.getGameTime()).toBe(0)
    })

    test('should format time correctly', () => {
      timeSystem.advanceTime(65) // 1 час 5 минут
      expect(timeSystem.getFormattedTime()).toBe('01:05')
    })

    test('should format time with leading zeros', () => {
      timeSystem.advanceTime(5) // 5 минут
      expect(timeSystem.getFormattedTime()).toBe('00:05')
    })

    test('should advance time manually', () => {
      timeSystem.advanceTime(30)
      expect(timeSystem.getGameTime()).toBe(30)
    })

    test('should accumulate time advances', () => {
      timeSystem.advanceTime(15)
      timeSystem.advanceTime(25)
      expect(timeSystem.getGameTime()).toBe(40)
    })
  })

  describe('Action hold system', () => {
    test('should start action hold', () => {
      timeSystem.startActionHold()
      expect(timeSystem.isRunning()).toBe(true)
    })

    test('should stop action hold', () => {
      timeSystem.startActionHold()
      timeSystem.stopActionHold()
      expect(timeSystem.isRunning()).toBe(false)
    })

    test('should not advance time when not holding', () => {
      const initialTime = timeSystem.getGameTime()
      timeSystem.update()
      expect(timeSystem.getGameTime()).toBe(initialTime)
    })
  })

  describe('Time progression during action hold', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test('should advance time every second during hold', () => {
      timeSystem.startActionHold()

      // Симулируем прохождение 3 секунд
      jest.advanceTimersByTime(3000)
      timeSystem.update()

      expect(timeSystem.getGameTime()).toBe(3)
    })

    test('should not advance time when hold is stopped', () => {
      timeSystem.startActionHold()

      // Симулируем 2 секунды
      jest.advanceTimersByTime(2000)
      timeSystem.update()

      timeSystem.stopActionHold()

      // Еще 2 секунды, но время не должно идти
      jest.advanceTimersByTime(2000)
      timeSystem.update()

      expect(timeSystem.getGameTime()).toBe(2)
    })

    test('should handle multiple update calls', () => {
      timeSystem.startActionHold()

      // Симулируем 1 секунду
      jest.advanceTimersByTime(1000)
      timeSystem.update()
      timeSystem.update() // Второй вызов не должен добавить время

      expect(timeSystem.getGameTime()).toBe(1)
    })
  })

  describe('Recovery system integration', () => {
    test('should trigger recovery when time advances', () => {
      const recoverySpy = jest.spyOn(timeSystem as any, 'triggerRecovery')

      timeSystem.advanceTime(1)

      expect(recoverySpy).toHaveBeenCalled()

      recoverySpy.mockRestore()
    })

    test('should trigger recovery during action hold', () => {
      jest.useFakeTimers()

      const recoverySpy = jest.spyOn(timeSystem as any, 'triggerRecovery')

      timeSystem.startActionHold()
      jest.advanceTimersByTime(1000)
      timeSystem.update()

      expect(recoverySpy).toHaveBeenCalled()

      recoverySpy.mockRestore()
      jest.useRealTimers()
    })
  })

  describe('Edge cases', () => {
    test('should handle negative time advance', () => {
      timeSystem.advanceTime(10)
      timeSystem.advanceTime(-5)
      expect(timeSystem.getGameTime()).toBe(5)
    })

    test('should handle zero time advance', () => {
      timeSystem.advanceTime(10)
      timeSystem.advanceTime(0)
      expect(timeSystem.getGameTime()).toBe(10)
    })

    test('should handle large time advances', () => {
      timeSystem.advanceTime(1440) // 24 часа
      expect(timeSystem.getFormattedTime()).toBe('24:00')
    })

    test('should handle multiple start/stop cycles', () => {
      timeSystem.startActionHold()
      timeSystem.stopActionHold()
      timeSystem.startActionHold()
      timeSystem.stopActionHold()

      expect(timeSystem.isRunning()).toBe(false)
    })
  })

  describe('Performance and memory', () => {
    test('should not leak memory with multiple instances', () => {
      const instances = []
      for (let i = 0; i < 100; i++) {
        instances.push(TimeSystem.getInstance())
      }

      // Все экземпляры должны быть одинаковыми
      const firstInstance = instances[0]
      instances.forEach(instance => {
        expect(instance).toBe(firstInstance)
      })
    })

    test('should handle rapid start/stop cycles', () => {
      for (let i = 0; i < 100; i++) {
        timeSystem.startActionHold()
        timeSystem.stopActionHold()
      }

      expect(timeSystem.isRunning()).toBe(false)
    })
  })
})
