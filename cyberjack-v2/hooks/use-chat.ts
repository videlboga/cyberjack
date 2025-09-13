// hooks/use-chat.ts

import { useState, useEffect, useCallback } from 'react'
import { ChatMessage, ChatSession, AIResponse } from '@/types/game'

export function useChat(characterId: string, userId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<ChatSession | null>(null)

  const sendMessage = useCallback(async (
    content: string,
    context?: any
  ): Promise<AIResponse | null> => {
    try {
      setLoading(true)
      setError(null)

      // Добавить сообщение пользователя
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        characterId,
        userId,
        content,
        timestamp: new Date(),
        isUser: true
      }

      setMessages(prev => [...prev, userMessage])

      const response = await fetch(`/api/chat/${characterId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          userId,
          context
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()

      // Добавить ответ ИИ
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        characterId,
        userId,
        content: data.response,
        timestamp: new Date(),
        isUser: false
      }

      setMessages(prev => [...prev, aiMessage])

      return {
        message: data.response,
        characterId: data.characterId,
        timestamp: data.timestamp
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }, [characterId, userId])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const loadChatHistory = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/chat/${characterId}/history?userId=${userId}`)
      if (!response.ok) {
        throw new Error('Failed to load chat history')
      }

      const data = await response.json()
      setMessages(data.messages || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [characterId, userId])

  const getLastMessage = useCallback(() => {
    return messages.length > 0 ? messages[messages.length - 1] : null
  }, [messages])

  const getMessageCount = useCallback(() => {
    return messages.length
  }, [messages])

  const getMessagesByUser = useCallback((isUser: boolean) => {
    return messages.filter(message => message.isUser === isUser)
  }, [messages])

  useEffect(() => {
    if (characterId && userId) {
      loadChatHistory()
    }
  }, [characterId, userId, loadChatHistory])

  return {
    messages,
    loading,
    error,
    session,
    sendMessage,
    clearChat,
    loadChatHistory,
    getLastMessage,
    getMessageCount,
    getMessagesByUser
  }
}
