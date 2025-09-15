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
}

export function ChatPanel({ characterId, characterName, gameContext, onNotification }: ChatPanelProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const requestData = {
        message: inputMessage,
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

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        isUser: false,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMessage])

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
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Извините, произошла ошибка при отправке сообщения.',
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
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
