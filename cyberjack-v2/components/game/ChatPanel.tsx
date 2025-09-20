"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
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
  onPoseChange?: () => void // Callback для обновления позы
}

export function ChatPanel({ characterId, characterName, gameContext, onNotification, refreshTrigger, onPoseChange }: ChatPanelProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastLoadTimeRef = useRef<number>(0)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadChatHistory = useCallback(async (forceReload = false) => {
    // Дебаунсинг: не загружаем чаще чем раз в 5 секунд
    const now = Date.now()
    if (!forceReload && now - lastLoadTimeRef.current < 5000) {
      console.log('⏸️ Пропускаем загрузку истории чата (дебаунсинг)')
      return
    }
    lastLoadTimeRef.current = now

    console.log('📥 Загружаем историю чата:', { forceReload, characterId })

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

        const buildSignature = (msg: Message) => `${msg.isUser ? 'user' : 'character'}::${msg.content.trim()}`

        if (forceReload) {
          // Полная перезагрузка (заменяем все сообщения)
          console.log('🔄 Полная перезагрузка чата:', formattedMessages.length, 'сообщений')
          setMessages(formattedMessages)
        } else {
          // Умное обновление: добавляем только новые сообщения и заменяем временные
          setMessages(prevMessages => {
            const nextMessages = new Map<string, Message>()
            const tempSignatures = new Map<string, string>()

            for (const msg of prevMessages) {
              nextMessages.set(msg.id, msg)
              if (msg.id.startsWith('temp_') || msg.id.startsWith('ai_')) {
                tempSignatures.set(buildSignature(msg), msg.id)
              }
            }

            let addedCount = 0
            for (const msg of formattedMessages) {
              const signature = buildSignature(msg)
              const tempId = tempSignatures.get(signature)
              if (tempId) {
                nextMessages.delete(tempId)
              }

              if (!nextMessages.has(msg.id)) {
                addedCount += 1
              }
              nextMessages.set(msg.id, msg)
            }

            if (addedCount > 0) {
              console.log('➕ Добавлены сообщения из истории:', addedCount)
            } else {
              console.log('✅ Новых сообщений нет, оставляем текущее состояние')
            }

            return Array.from(nextMessages.values()).sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            )
          })
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки истории чата:', error)
    }
  }, [characterId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Загружаем сообщения из базы данных при монтировании
  useEffect(() => {
    if (characterId) {
      loadChatHistory(true) // Полная перезагрузка при монтировании
    }
  }, [characterId])

  // Отключаем автоматическое обновление - обновляем только при необходимости
  // useEffect(() => {
  //   if (!characterId) return
  //   const interval = setInterval(() => {
  //     if (!isLoading) {
  //       loadChatHistory()
  //     }
  //   }, 30000)
  //   return () => clearInterval(interval)
  // }, [characterId, isLoading, loadChatHistory])

  // Обновление чата при изменении refreshTrigger (только если это действительно новое значение)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0 && characterId && !isLoading) {
      console.log('🔄 Обновляем чат по refreshTrigger:', refreshTrigger)
      loadChatHistory()
    }
  }, [refreshTrigger, characterId, isLoading, loadChatHistory])

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const messageToSend = inputMessage
    setInputMessage('')
    setIsLoading(true)

    // Добавляем сообщение пользователя оптимистично (сразу показываем)
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

      // Добавляем ответ ИИ в чат
      const aiMessage: Message = {
        id: `ai_${Date.now()}`,
        content: data.response,
        isUser: false,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMessage])

      // Не обновляем историю чата автоматически - сообщения уже добавлены
      // setTimeout(() => {
      //   loadChatHistory()
      // }, 1000)

      // Обновляем позу после получения ответа (на случай если была команда позы)
      if (onPoseChange) {
        console.log('🔄 Вызываем onPoseChange для обновления позы')
        onPoseChange()
      } else {
        console.log('⚠️ onPoseChange не передан в ChatPanel')
      }

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

      // После успешного ответа подтягиваем сохранённую историю, чтобы заменить временные сообщения
      await loadChatHistory()
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
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            <p className="text-sm ">Начните диалог с {characterName}</p>
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
                      ? 'liquid-glass-card border border-blue-400 border-opacity-30 text-white neon-border-blue'
                      : 'liquid-glass-card border border-cyan-400 border-opacity-30 text-gray-100 neon-border'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="liquid-glass-card border border-cyan-400 border-opacity-30 px-3 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-cyan-400"></div>
                    <span className="text-xs text-cyan-300">Печатает...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="flex gap-2 p-3 border-t border-cyan-400 border-opacity-30">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Введите сообщение..."
          className="flex-1 glass-input px-3 py-2 rounded-md text-sm"
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !inputMessage.trim()}
          className="glass-button neon-border-blue px-4 py-2 rounded-md text-sm transition-colors liquid-shimmer disabled:opacity-50"
        >
          Отправить
        </button>
      </div>
    </div>
  )
}
