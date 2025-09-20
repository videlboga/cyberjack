import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// POST /api/upload/avatar - загрузить аватар без привязки к персонажу
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Файл не найден' },
        { status: 400 }
      )
    }

    // Проверяем тип файла
    const fileType = getFileType(file.name)
    if (!fileType) {
      return NextResponse.json(
        { error: 'Неподдерживаемый тип файла. Разрешены только изображения (jpg, jpeg, png, gif, webp)' },
        { status: 400 }
      )
    }

    // Проверяем размер файла (максимум 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Файл слишком большой. Максимальный размер: 5MB' },
        { status: 400 }
      )
    }

    // Создаем уникальное имя файла
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop()
    const filename = `${timestamp}_${randomId}.${extension}`

    // Создаем директорию для временных аватаров
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'temp', 'avatars')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Сохраняем файл
    const filePath = join(uploadDir, filename)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Создаем URL для доступа к файлу
    const fileUrl = `/uploads/temp/avatars/${filename}`

    return NextResponse.json({
      success: true,
      url: fileUrl,
      filename: filename,
      size: file.size,
      type: fileType
    })
  } catch (error) {
    console.error('Error uploading avatar:', error)
    return NextResponse.json(
      { error: 'Ошибка загрузки аватара' },
      { status: 500 }
    )
  }
}

function getFileType(filename: string): 'image' | null {
  const ext = filename.toLowerCase().split('.').pop()
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']

  if (imageExtensions.includes(ext || '')) {
    return 'image'
  }

  return null
}
