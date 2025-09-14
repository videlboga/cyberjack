import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// POST /api/characters/poses/[characterPoseId]/angles-v2/[angleId]/upload - загрузить файлы для ракурса
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterPoseId: string; angleId: string }> }
) {
  try {
    const { characterPoseId, angleId } = await params

    // Проверяем, что ракурс существует
    const existingAngle = await prisma.characterPoseAngle.findFirst({
      where: {
        id: angleId,
        characterPoseId
      }
    })

    if (!existingAngle) {
      return NextResponse.json(
        { error: 'Character pose angle not found' },
        { status: 404 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const uploadedFiles = []

    for (const file of files) {
      // Проверяем тип файла
      const fileType = getFileType(file.name)
      if (!fileType) {
        continue // Пропускаем неподдерживаемые файлы
      }

      // Создаем уникальное имя файла
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 8)
      const extension = file.name.split('.').pop()
      const filename = `${timestamp}_${randomId}.${extension}`

      // Создаем директорию для файлов
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'pose-angles', characterPoseId, angleId)
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }

      // Сохраняем файл
      const filePath = join(uploadDir, filename)
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      // Создаем URL для доступа к файлу
      const fileUrl = `/uploads/pose-angles/${characterPoseId}/${angleId}/${filename}`

      uploadedFiles.push({
        id: `${timestamp}_${randomId}`,
        url: fileUrl,
        type: fileType,
        filename: file.name,
        size: file.size
      })
    }

    // Обновляем медиа в базе данных
    const currentMedia = existingAngle.media as any || { files: [] }
    const updatedMedia = {
      ...currentMedia,
      files: [...currentMedia.files, ...uploadedFiles]
    }

    await prisma.characterPoseAngle.update({
      where: { id: angleId },
      data: {
        media: updatedMedia
      }
    })

    return NextResponse.json(uploadedFiles)
  } catch (error) {
    console.error('Error uploading files:', error)
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    )
  }
}

function getFileType(filename: string): 'image' | 'video' | 'gif' | null {
  const ext = filename.toLowerCase().split('.').pop()

  if (!ext) return null

  // GIF файлы
  if (ext === 'gif') return 'gif'

  // Видео файлы
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video'

  // Изображения
  if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'svg'].includes(ext)) return 'image'

  return null
}
