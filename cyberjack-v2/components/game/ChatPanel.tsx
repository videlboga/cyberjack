"use client"

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

interface ChatPanelProps {
  characterId: string
  characterName: string
  gameContext?: {
    currentPose?: string
    currentAngle?: string
    selectedAction?: string
    actionInProgress?: boolean
  }
  onNotification?: (notification: {
    id: number
    type: 'action' | 'characteristic' | 'pose' | 'equipment' | 'time' | 'info' | 'warning' | 'error'
    message: string
    timestamp: Date
    data?: any
  }) => void
  refreshTrigger?: number // Добавляем триггер для обновления
}

export function ChatPanel({ characterId, characterName, gameContext, onNotification, refreshTrigger }: ChatPanelProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/chat/${characterId}/history`)
      if (response.ok) {
        const chatHistory = await response.json()
        const formattedMessages: Message[] = chatHistory.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          isUser: msg.messageType === 'user',
          timestamp: new Date(msg.createdAt)
        }))
        setMessages(formattedMessages)
      }
    } catch (error) {
      console.error('Ошибка загрузки истории чата:', error)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Загружаем сообщения из базы данных при монтировании
  useEffect(() => {
    if (characterId) {
      loadChatHistory()
    }
  }, [characterId])

  // Автоматическое обновление чата каждые 3 секунды
  useEffect(() => {
    if (!characterId) return

    const interval = setInterval(() => {
      loadChatHistory()
    }, 3000) // Обновляем каждые 3 секунды

    return () => clearInterval(interval)
  }, [characterId])

  // Обновление чата при изменении refreshTrigger
  useEffect(() => {
    if (refreshTrigger && characterId) {
      loadChatHistory()
    }
  }, [refreshTrigger, characterId])

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const messageToSend = inputMessage
    setInputMessage('')
    setIsLoading(true)

    // Добавляем сообщение пользователя сразу в интерфейс
    const userMessage: Message = {
      id: `temp_${Date.now()}`,
      content: messageToSend,
      isUser: true,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const requestData = {
        message: messageToSend,
        userId: session?.user?.id || '',
        context: {
          currentPose: gameContext?.currentPose,
          currentAngle: gameContext?.currentAngle,
          selectedAction: gameContext?.selectedAction,
          actionInProgress: gameContext?.actionInProgress,
          timestamp: new Date().toISOString()
        }
      }

      console.log('💬 Sending chat message:', requestData)

      const response = await fetch(`/api/chat/${characterId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error('Ошибка отправки сообщения')
      }

      const data = await response.json()
      console.log('💬 Received AI response:', data)

      // Перезагружаем историю чата, чтобы получить актуальные сообщения из базы данных
      await loadChatHistory()

      // Проверяем, есть ли изменения характеристик в метаданных
      if (data.metadata?.characteristicChanges && data.metadata.characteristicChanges.length > 0) {
        data.metadata.characteristicChanges.forEach((change: any) => {
          if (onNotification) {
            onNotification({
              id: Date.now() + Math.random(),
              type: 'characteristic',
              message: `${change.name}: ${change.change > 0 ? '+' : ''}${change.change.toFixed(1)}`,
              timestamp: new Date(),
              data: {
                effects: [{
                  characteristicId: change.name,
                  change: change.change
                }]
              }
            })
          }
        })
      }
    } catch (error) {
      console.error('Chat error:', error)

      // Удаляем временное сообщение пользователя при ошибке
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id))

      // Показываем ошибку через уведомления
      if (onNotification) {
        onNotification({
          id: Date.now(),
          type: 'error',
          message: 'Ошибка при отправке сообщения',
          timestamp: new Date()
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="h-full flex flex-col bg-transparent">
      <div className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            <p className="text-sm">Начните диалог с {characterName}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    message.isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-700 px-3 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
                    <span className="text-xs text-gray-300">Печатает...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="flex gap-2 p-3 border-t border-gray-700">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Введите сообщение..."
          className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !inputMessage.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-md text-sm transition-colors"
        >
          Отправить
        </button>
      </div>
    </div>
  )
}
