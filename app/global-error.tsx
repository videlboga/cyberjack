'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Критическая ошибка!</h2>
            <p className="text-gray-600 mb-4">{error.message}</p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
