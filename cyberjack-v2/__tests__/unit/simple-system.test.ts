// __tests__/unit/simple-system.test.ts - Упрощенные тесты систем

import { describe, test, expect } from '@jest/globals'
import { TimeSystem } from '@/lib/core/time/time-system'

describe('Simple System Tests', () => {
  describe('TimeSystem', () => {
    test('should be a singleton', () => {
      const instance1 = TimeSystem.getInstance()
      const instance2 = TimeSystem.getInstance()
      expect(instance1).toBe(instance2)
    })

    test('should start with zero game time', () => {
      const timeSystem = TimeSystem.getInstance()
      timeSystem.reset()
      expect(timeSystem.getGameTime()).toBe(0)
    })

    test('should format time correctly', () => {
      const timeSystem = TimeSystem.getInstance()
      timeSystem.reset()
      timeSystem.advanceTime(65) // 1 час 5 минут
      expect(timeSystem.getFormattedTime()).toBe('01:05')
    })

    test('should advance time manually', () => {
      const timeSystem = TimeSystem.getInstance()
      timeSystem.reset()
      timeSystem.advanceTime(30)
      expect(timeSystem.getGameTime()).toBe(30)
    })

    test('should handle action hold', () => {
      const timeSystem = TimeSystem.getInstance()
      timeSystem.reset()

      timeSystem.startActionHold()
      expect(timeSystem.isRunning()).toBe(true)

      timeSystem.stopActionHold()
      expect(timeSystem.isRunning()).toBe(false)
    })

    test('should accumulate time advances', () => {
      const timeSystem = TimeSystem.getInstance()
      timeSystem.reset()

      timeSystem.advanceTime(15)
      timeSystem.advanceTime(25)
      expect(timeSystem.getGameTime()).toBe(40)
    })
  })

  describe('Basic functionality', () => {
    test('should handle basic math operations', () => {
      expect(2 + 2).toBe(4)
      expect(10 - 5).toBe(5)
      expect(3 * 4).toBe(12)
      expect(8 / 2).toBe(4)
    })

    test('should handle string operations', () => {
      const str = 'Hello World'
      expect(str.length).toBe(11)
      expect(str.toUpperCase()).toBe('HELLO WORLD')
      expect(str.toLowerCase()).toBe('hello world')
    })

    test('should handle array operations', () => {
      const arr = [1, 2, 3, 4, 5]
      expect(arr.length).toBe(5)
      expect(arr.includes(3)).toBe(true)
      expect(arr.filter(x => x > 3)).toEqual([4, 5])
    })

    test('should handle object operations', () => {
      const obj = { name: 'Test', value: 42 }
      expect(obj.name).toBe('Test')
      expect(obj.value).toBe(42)
      expect(Object.keys(obj)).toEqual(['name', 'value'])
    })
  })

  describe('Async operations', () => {
    test('should handle promises', async () => {
      const promise = Promise.resolve('test')
      const result = await promise
      expect(result).toBe('test')
    })

    test('should handle async/await', async () => {
      const asyncFunction = async () => {
        return new Promise(resolve => {
          setTimeout(() => resolve('async result'), 10)
        })
      }

      const result = await asyncFunction()
      expect(result).toBe('async result')
    })
  })
})
