// hooks/use-time.ts

import { useState, useEffect, useCallback } from 'react'
import { TimeSystemState } from '@/types/game'

export function useTime() {
  const [timeState, setTimeState] = useState<TimeSystemState>({
    gameTime: 0,
    formattedTime: '00:00',
    isRunning: false,
    actionHoldStart: null,
    lastUpdate: new Date()
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTimeState = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/time/advance')
      if (!response.ok) {
        throw new Error('Failed to fetch time state')
      }

      const data = await response.json()
      setTimeState(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const advanceTime = useCallback(async (minutes: number, reason: string = 'manual') => {
    try {
      const response = await fetch('/api/time/advance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ minutes, reason }),
      })

      if (!response.ok) {
        throw new Error('Failed to advance time')
      }

      const data = await response.json()
      setTimeState(prev => ({
        ...prev,
        gameTime: data.gameTime,
        formattedTime: data.formattedTime
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  const startActionHold = useCallback(() => {
    setTimeState(prev => ({
      ...prev,
      isRunning: true,
      actionHoldStart: new Date()
    }))
  }, [])

  const stopActionHold = useCallback(() => {
    setTimeState(prev => ({
      ...prev,
      isRunning: false,
      actionHoldStart: null
    }))
  }, [])

  useEffect(() => {
    fetchTimeState()
  }, [fetchTimeState])

  // Обновление времени каждую секунду при активном холде
  useEffect(() => {
    if (!timeState.isRunning) return

    const interval = setInterval(() => {
      setTimeState(prev => ({
        ...prev,
        gameTime: prev.gameTime + 1,
        formattedTime: formatTime(prev.gameTime + 1)
      }))
    }, 1000)

    return () => clearInterval(interval)
  }, [timeState.isRunning])

  return {
    timeState,
    loading,
    error,
    advanceTime,
    startActionHold,
    stopActionHold,
    refetch: fetchTimeState
  }
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

