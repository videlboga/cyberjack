// middleware.ts

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAdmin = token?.role === 'ADMIN' || token?.role === 'SUPER_ADMIN'
    const isAuthPage = req.nextUrl.pathname.startsWith('/auth/')

    // Если пользователь не авторизован и пытается попасть на защищенные страницы
    if (!token && !isAuthPage && !req.nextUrl.pathname.startsWith('/api/auth')) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    // Если пользователь авторизован и находится на странице входа
    if (token && isAuthPage) {
      return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/game', req.url))
    }

    // Проверка доступа к админ-панели
    if (req.nextUrl.pathname.startsWith('/admin') && !isAdmin) {
      return NextResponse.redirect(new URL('/game', req.url))
    }

    // API endpoints проверяют авторизацию самостоятельно
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
)

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/game/:path*',
    '/db/:path*',
    '/auth/signin'
  ]
}
