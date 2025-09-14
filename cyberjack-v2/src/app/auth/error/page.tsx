"use client"

import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'Configuration':
        return 'Проблема с конфигурацией сервера'
      case 'AccessDenied':
        return 'Доступ запрещен'
      case 'Verification':
        return 'Ошибка верификации'
      default:
        return 'Произошла ошибка при аутентификации'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md text-center">
        <div>
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Ошибка аутентификации
          </h2>
          <p className="text-gray-600 mb-6">
            {getErrorMessage(error)}
          </p>

          <Link href="/auth/signin">
            <Button className="w-full">
              Вернуться к входу
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
