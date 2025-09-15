"use client"

import { useState, useEffect } from 'react'

interface Notification {
  id: number
  type: 'action' | 'characteristic' | 'pose' | 'equipment' | 'time' | 'info' | 'warning' | 'error'
  message: string
  timestamp: Date
  duration?: number
  data?: any
}

interface NotificationSystemProps {
  notifications: Notification[]
  onRemoveNotification: (id: number) => void
}

export function NotificationSystem({ notifications, onRemoveNotification }: NotificationSystemProps) {
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([])

  useEffect(() => {
    // Добавляем новые уведомления
    const newNotifications = notifications.filter(
      n => !visibleNotifications.find(vn => vn.id === n.id)
    )

    if (newNotifications.length > 0) {
      setVisibleNotifications(prev => [...prev, ...newNotifications])
    }
  }, [notifications, visibleNotifications])

  useEffect(() => {
    // Автоматическое удаление уведомлений
    const timers = visibleNotifications.map(notification => {
      const duration = notification.duration || getDefaultDuration(notification.type)

      return setTimeout(() => {
        onRemoveNotification(notification.id)
        setVisibleNotifications(prev => prev.filter(n => n.id !== notification.id))
      }, duration)
    })

    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [visibleNotifications, onRemoveNotification])

  const getDefaultDuration = (type: string) => {
    switch (type) {
      case 'error': return 8000
      case 'warning': return 6000
      case 'action': return 4000
      case 'characteristic': return 5000
      case 'pose': return 3000
      case 'equipment': return 4000
      case 'time': return 3000
      default: return 4000
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'action': return '⚡'
      case 'characteristic': return '📊'
      case 'pose': return '🎭'
      case 'equipment': return '🎒'
      case 'time': return '⏰'
      case 'info': return 'ℹ️'
      case 'warning': return '⚠️'
      case 'error': return '❌'
      default: return '📢'
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'error': return 'bg-red-600 border-red-500'
      case 'warning': return 'bg-yellow-600 border-yellow-500'
      case 'action': return 'bg-blue-600 border-blue-500'
      case 'characteristic': return 'bg-green-600 border-green-500'
      case 'pose': return 'bg-purple-600 border-purple-500'
      case 'equipment': return 'bg-orange-600 border-orange-500'
      case 'time': return 'bg-gray-600 border-gray-500'
      case 'info': return 'bg-blue-600 border-blue-500'
      default: return 'bg-gray-600 border-gray-500'
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const seconds = Math.floor(diff / 1000)

    if (seconds < 60) {
      return 'только что'
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      return `${minutes} мин назад`
    } else {
      return timestamp.toLocaleTimeString()
    }
  }

  if (visibleNotifications.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`${getNotificationColor(notification.type)} text-white p-4 rounded-lg shadow-lg border-l-4 transform transition-all duration-300 ease-in-out animate-slide-in-right`}
        >
          <div className="flex items-start gap-3">
            <div className="text-xl flex-shrink-0">
              {getNotificationIcon(notification.type)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium mb-1">
                {notification.message}
              </div>

              <div className="text-xs opacity-75">
                {formatTimestamp(notification.timestamp)}
              </div>

              {/* Дополнительные данные */}
              {notification.data && (
                <div className="mt-2 text-xs opacity-90">
                  {notification.type === 'characteristic' && notification.data.effects && (
                    <div>
                      {notification.data.effects.map((effect: any, index: number) => (
                        <div key={index} className="flex justify-between">
                          <span>{effect.characteristicId}:</span>
                          <span className={effect.change > 0 ? 'text-green-300' : 'text-red-300'}>
                            {effect.change > 0 ? '+' : ''}{effect.change.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                onRemoveNotification(notification.id)
                setVisibleNotifications(prev => prev.filter(n => n.id !== notification.id))
              }}
              className="text-white opacity-75 hover:opacity-100 transition-opacity flex-shrink-0"
            >
              ×
            </button>
          </div>

          {/* Прогресс-бар */}
          <div className="mt-2 h-1 bg-black bg-opacity-20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white bg-opacity-30 transition-all ease-linear"
              style={{
                width: '100%',
                animation: `shrink ${getDefaultDuration(notification.type)}ms linear forwards`
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// CSS анимации (добавить в globals.css)
const styles = `
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes shrink {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}
`

// Добавляем стили в head (в реальном проекте это должно быть в globals.css)
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = styles
  document.head.appendChild(styleSheet)
}
