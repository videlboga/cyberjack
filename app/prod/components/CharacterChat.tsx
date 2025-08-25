'use client';

import React, { useState, useRef, useEffect } from 'react'
import { Talent } from '@/lib/types'

interface CharacterChatProps {
  characterAI: any
  selectedTalent: Talent
  onClose: () => void
}

export function CharacterChat({ characterAI, selectedTalent, onClose }: CharacterChatProps) {
  const [messages, setMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string; timestamp: Date }>>([])
  const [currentMessage, setCurrentMessage] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [position, setPosition] = useState(() => {
    // Центрируем чат при первом открытии
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(0, (window.innerWidth - 384) / 2),
        y: Math.max(0, (window.innerHeight - 400) / 2)
      }
    }
    return { x: 400, y: 100 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const generateUniqueId = () => {
    return Math.random().toString(36).substr(2, 9)
  }

  const sendMessage = async (message: string) => {
    if (!message.trim() || isProcessing) return

    const userMessage = {
      id: generateUniqueId(),
      role: "user" as const,
      content: message,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setCurrentMessage("")
    setIsProcessing(true)

    try {
      // Используем Character AI для анализа сообщения с данными выбранного персонажа
      const analysis = await characterAI.analyzeMessage(message, selectedTalent)
      
      const assistantMessage = {
        id: generateUniqueId(),
        role: "assistant" as const,
        content: analysis.response,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
      
      // Применяем изменения от анализа
      if (analysis.statChanges && Object.keys(analysis.statChanges).length > 0) {
        console.log('Изменения от Character AI:', analysis.statChanges)
      }
    } catch (error) {
      console.error('Ошибка Character AI:', error)
      
      const assistantMessage = {
        id: generateUniqueId(),
        role: "assistant" as const,
        content: "Извините, произошла ошибка при обработке сообщения.",
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(currentMessage)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      
      // Ограничиваем позицию границами экрана
      const maxX = window.innerWidth - 384 // w-96 = 384px
      const maxY = window.innerHeight - 400 // примерная высота панели
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  return (
    <div 
      className="fixed glass-panel border border-cyan-500/50 rounded-lg z-50 w-96 max-h-[80vh] flex flex-col cursor-move"
      style={{ left: position.x, top: position.y }}
    >
      <div 
        className="p-3 border-b border-gray-600 flex items-center justify-between"
        onMouseDown={handleMouseDown}
      >
        <h3 className="font-semibold text-cyan-400">
          💬 Чат с {selectedTalent.name}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-2 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-8">
            Начните разговор с {selectedTalent.name}...
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-2 rounded text-sm ${
              message.role === "user" 
                ? "bg-cyan-600/20 text-cyan-100 ml-8" 
                : "bg-gray-700/50 text-gray-100 mr-8"
            }`}
          >
            {message.content}
          </div>
        ))}
        
        {isProcessing && (
          <div className="text-center text-gray-400 text-sm">
            {selectedTalent.name} печатает...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-600">
        <div className="flex gap-2">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Введите сообщение..."
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
            disabled={isProcessing}
          />
          <button
            onClick={() => sendMessage(currentMessage)}
            disabled={!currentMessage.trim() || isProcessing}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded text-white"
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  )
}
