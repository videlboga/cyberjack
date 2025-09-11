import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Начинаем загрузку изображения для позы')

    const formData = await request.formData()
    const file = formData.get('image') as File
    const angleId = formData.get('angleId') as string
    const poseId = formData.get('poseId') as string

    if (!file) {
      console.error('❌ Файл не найден')
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })
    }

    if (!angleId || !poseId) {
      console.error('❌ Отсутствуют angleId или poseId')
      return NextResponse.json({ error: 'Отсутствуют параметры angleId или poseId' }, { status: 400 })
    }

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      console.error('❌ Неподдерживаемый тип файла:', file.type)
      return NextResponse.json({ error: 'Файл должен быть изображением' }, { status: 400 })
    }

    // Проверяем размер файла (макс 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.error('❌ Файл слишком большой:', file.size)
      return NextResponse.json({ error: 'Файл слишком большой (макс 10MB)' }, { status: 400 })
    }

    // Создаем директорию если не существует
    const uploadDir = join(process.cwd(), 'public', 'images', 'poses')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
      console.log('📁 Создана директория:', uploadDir)
    }

    // Генерируем уникальное имя файла
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const fileName = `${poseId}_${angleId}_${timestamp}.${fileExtension}`
    const thumbnailName = `${poseId}_${angleId}_${timestamp}_thumb.${fileExtension}`

    const filePath = join(uploadDir, fileName)
    const thumbnailPath = join(uploadDir, thumbnailName)

    // Конвертируем файл в buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Сохраняем оригинальное изображение
    await writeFile(filePath, buffer)
    console.log('💾 Сохранено изображение:', filePath)

    // Создаем миниатюру (простое копирование для начала)
    await writeFile(thumbnailPath, buffer)
    console.log('💾 Сохранена миниатюра:', thumbnailPath)

    // Формируем URL для доступа к файлу
    const imageUrl = `/images/poses/${fileName}`
    const thumbnailUrl = `/images/poses/${thumbnailName}`

    console.log('✅ Изображение успешно загружено:', {
      imageUrl,
      thumbnailUrl,
      fileSize: file.size,
      fileType: file.type
    })

    return NextResponse.json({
      success: true,
      message: 'Изображение успешно загружено',
      imageUrl,
      thumbnailUrl,
      fileName,
      fileSize: file.size
    })

  } catch (error) {
    console.error('❌ Ошибка при загрузке изображения:', error)
    return NextResponse.json({
      error: 'Внутренняя ошибка сервера',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
