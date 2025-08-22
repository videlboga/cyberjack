"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Shield, Zap, Star } from 'lucide-react'

interface RegistrationModalProps {
  isOpen: boolean
  onClose: () => void
  onRegister: (username: string, password: string) => void
}

export default function RegistrationModal({ isOpen, onClose, onRegister }: RegistrationModalProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [userExists, setUserExists] = useState(false)

  // Проверка существования пользователя
  const checkUserExists = (username: string) => {
    const users = JSON.parse(localStorage.getItem('allUsers') || '[]')
    const exists = users.some((user: any) => user.username.toLowerCase() === username.toLowerCase())
    console.log('🔍 Проверка пользователя:', username, 'существует:', exists, 'все пользователи:', users)
    return exists
  }

  // Обработка изменения имени пользователя
  const handleUsernameChange = (value: string) => {
    setUsername(value)
    if (value.trim()) {
      const exists = checkUserExists(value.trim())
      setUserExists(exists)
      setIsLogin(exists)
    } else {
      setUserExists(false)
      setIsLogin(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return

    console.log('📝 Отправка формы:', { username: username.trim(), password: password.trim() })
    console.log('🔍 onRegister функция:', typeof onRegister)
    setIsLoading(true)
    
    // Вызываем регистрацию сразу
    console.log('🚀 Вызываем onRegister с:', username.trim(), password.trim())
    try {
      onRegister(username.trim(), password.trim())
      console.log('✅ onRegister вызван успешно')
      
      // Закрываем модальное окно сразу после успешной регистрации
      console.log('🚪 Закрываем модальное окно...')
      onClose()
      console.log('✅ Модальное окно закрыто')
    } catch (error) {
      console.error('❌ Ошибка при вызове onRegister:', error)
    }
    setIsLoading(false)
    setUsername('')
    setPassword('')
    setUserExists(false)
    setIsLogin(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border-cyan-500/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Nexus Enslaver
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Приветствие */}
          <Card className="bg-gray-800/50 border-cyan-500/30">
            <CardHeader className="text-center">
              <CardTitle className="text-cyan-400">
                {isLogin ? 'С возвращением!' : 'Добро пожаловать в будущее'}
              </CardTitle>
              <CardDescription className="text-gray-300">
                {isLogin 
                  ? 'Введите пароль для входа в систему' 
                  : 'Управляйте активами, развивайте таланты, создавайте империю'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-cyan-300">
                  <User className="w-4 h-4" />
                  <span>Управление активами</span>
                </div>
                <div className="flex items-center gap-2 text-purple-300">
                  <Shield className="w-4 h-4" />
                  <span>Нейроинтерфейсы</span>
                </div>
                <div className="flex items-center gap-2 text-green-300">
                  <Zap className="w-4 h-4" />
                  <span>Тренировки</span>
                </div>
                <div className="flex items-center gap-2 text-yellow-300">
                  <Star className="w-4 h-4" />
                  <span>Развитие</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Форма регистрации */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-cyan-300">
                Имя пользователя
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="Введите ваше имя"
                  className={`bg-gray-800/50 text-white placeholder-gray-400 focus:border-cyan-400 ${
                    userExists 
                      ? 'border-green-500/50 focus:border-green-400' 
                      : 'border-cyan-500/30'
                  }`}
                  disabled={isLoading}
                  required
                />
                {username && (
                  <div className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-xs px-2 py-1 rounded ${
                    userExists 
                      ? 'bg-green-600/20 text-green-400' 
                      : 'bg-blue-600/20 text-blue-400'
                  }`}>
                    {userExists ? 'Вход' : 'Новый'}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-cyan-300">
                Пароль
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? "Введите пароль" : "Создайте пароль"}
                className="bg-gray-800/50 border-cyan-500/30 text-white placeholder-gray-400 focus:border-cyan-400"
                disabled={isLoading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 text-white"
              disabled={isLoading || !username.trim() || !password.trim()}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isLogin ? 'Вход...' : 'Регистрация...'}
                </div>
              ) : (
                isLogin ? 'Войти в игру' : 'Начать игру'
              )}
            </Button>
          </form>

          {/* Информация о стартовом пакете */}
          <Card className="bg-gray-800/30 border-green-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-green-400 text-lg">Стартовый пакет</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Кредиты:</span>
                <Badge variant="secondary" className="bg-green-600/20 text-green-400 border-green-500/30">
                  5000
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Neural Pulses:</span>
                <Badge variant="secondary" className="bg-cyan-600/20 text-cyan-400 border-cyan-500/30">
                  100
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Активы:</span>
                <Badge variant="secondary" className="bg-purple-600/20 text-purple-400 border-purple-500/30">
                  3
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
