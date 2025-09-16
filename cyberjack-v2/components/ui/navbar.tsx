"use client"

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const { data: session } = useSession()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push('/auth/signin')
  }

  if (!session) {
    return null
  }

  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN'

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-gray-900">
              🎮 CyberJack v2.0
            </Link>

            <div className="hidden md:flex space-x-6">
              <Link
                href="/game"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Игра
              </Link>

              {isAdmin && (
                <>
                  <Link
                    href="/admin"
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Админ-панель
                  </Link>
                  <Link
                    href="/admin/logs"
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Логи
                  </Link>
                  <Link
                    href="/db"
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    База данных
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{session.user.name}</span>
              <span className="ml-2 px-2 py-1 bg-gray-100 rounded-full text-xs">
                {session.user.role}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
            >
              Выйти
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
