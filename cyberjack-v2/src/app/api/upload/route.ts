import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

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
        { error: 'Неподдерживаемый тип файла' },
        { status: 400 }
      )
    }

    // Создаем уникальное имя файла
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop()
    const filename = `${timestamp}_${randomId}.${extension}`

    // Определяем директорию для загрузки
    let uploadDir: string
    let fileUrl: string

    if (type === 'background') {
      uploadDir = join(process.cwd(), 'public', 'uploads', 'scenes', 'backgrounds')
      fileUrl = `/uploads/scenes/backgrounds/${filename}`
    } else if (type === 'music') {
      uploadDir = join(process.cwd(), 'public', 'uploads', 'scenes', 'music')
      fileUrl = `/uploads/scenes/music/${filename}`
    } else {
      return NextResponse.json(
        { error: 'Неизвестный тип медиа' },
        { status: 400 }
      )
    }

    // Создаем директорию если она не существует
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Сохраняем файл
    const filePath = join(uploadDir, filename)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    return NextResponse.json({
      url: fileUrl,
      filename: file.name,
      size: file.size,
      type: fileType
    })

  } catch (error) {
    console.error('Ошибка при загрузке файла:', error)
    return NextResponse.json(
      { error: 'Ошибка при загрузке файла' },
      { status: 500 }
    )
  }
}

function getFileType(filename: string): 'image' | 'video' | 'audio' | null {
  const ext = filename.toLowerCase().split('.').pop()

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
  const videoExts = ['mp4', 'webm', 'ogg', 'avi', 'mov']
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac']

  if (imageExts.includes(ext || '')) return 'image'
  if (videoExts.includes(ext || '')) return 'video'
  if (audioExts.includes(ext || '')) return 'audio'

  return null
}
