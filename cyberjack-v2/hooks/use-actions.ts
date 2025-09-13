// hooks/use-actions.ts

import { useState, useEffect, useCallback } from 'react'
import { ActionDisplay, ActionExecution } from '@/types/game'

export function useActions(characterId: string, userId: string) {
  const [actions, setActions] = useState<ActionDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)

  const fetchAvailableActions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/actions/available?characterId=${characterId}&userId=${userId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch available actions')
      }

      const data = await response.json()
      setActions(data.actions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [characterId, userId])

  const executeAction = useCallback(async (
    actionId: string,
    zoneId?: string
  ): Promise<ActionExecution | null> => {
    try {
      setExecuting(true)
      setError(null)

      const response = await fetch('/api/actions/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId,
          actionId,
          userId,
          zoneId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to execute action')
      }

      const result = await response.json()

      return {
        actionId,
        characterId,
        userId,
        startTime: new Date(),
        endTime: new Date(),
        effects: result.effects || []
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setExecuting(false)
    }
  }, [characterId, userId])

  const getActionsByCategory = useCallback((category: string) => {
    return actions.filter(action => action.category === category)
  }, [actions])

  const getActionById = useCallback((actionId: string) => {
    return actions.find(action => action.id === actionId)
  }, [actions])

  useEffect(() => {
    if (characterId && userId) {
      fetchAvailableActions()
    }
  }, [characterId, userId, fetchAvailableActions])

  return {
    actions,
    loading,
    error,
    executing,
    executeAction,
    getActionsByCategory,
    getActionById,
    refetch: fetchAvailableActions
  }
}

