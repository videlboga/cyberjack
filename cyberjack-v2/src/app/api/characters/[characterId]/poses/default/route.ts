import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterId: string }> }
) {
  try {
    const { characterId } = await params
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Сначала пытаемся получить активную позу из копии персонажа
    console.log('🔍 Ищем активную позу в копии персонажа:', { characterId, userId })

    const characterCopy = await prisma.characterCopy.findFirst({
      where: {
        characterId,
        userId
      }
    })

    let activePoseId = null
    let activeAngleId = null
    if (characterCopy?.settings && typeof characterCopy.settings === 'object' && characterCopy.settings !== null) {
      const settings = characterCopy.settings as any
      if (settings.currentPose) {
        activePoseId = settings.currentPose as string
        console.log('✅ Найдена активная поза в копии:', activePoseId)
      }
      if (settings.currentAngle) {
        activeAngleId = settings.currentAngle as string
        console.log('✅ Найден активный ракурс в копии:', activeAngleId)
      }
    }

    // Получаем персонажа с его позами
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        poses: {
          where: { isActive: true },
          include: {
            definition: true,
            angles: {
              include: {
                zones: true
              }
            }
          }
        }
      }
    })

    if (!character) {
      return NextResponse.json(
        { error: 'Персонаж не найден' },
        { status: 404 }
      )
    }

    // Ищем позу: сначала активную из копии, потом дефолтную, потом первую активную
    console.log('📋 Доступные позы:', character.poses.map(p => ({ id: p.id, name: p.definition.name, isDefault: p.isDefault })))

    let defaultPose = null

    // 1. Пытаемся найти активную позу из копии с медиа
    if (activePoseId) {
      defaultPose = character.poses.find(pose => pose.definition.id === activePoseId)
      if (defaultPose) {
        console.log('✅ Найдена активная поза из копии:', defaultPose.definition.name)
        // Проверяем, есть ли у неё персонализированные ракурсы с медиа
        const hasMedia = defaultPose.angles.some(angle => {
          const media = angle.media as any || { images: [], files: [] }
          return (media.images && media.images.length > 0) || (media.files && media.files.length > 0)
        })

        if (!hasMedia) {
          console.log('⚠️ У активной позы нет медиа, ищем другую')
          defaultPose = null
        } else {
          console.log('✅ У активной позы есть медиа, используем её')
        }
      }
    }

    // 2. Если не найдена или нет медиа, ищем дефолтную позу с медиа
    if (!defaultPose) {
      for (const pose of character.poses) {
        if (pose.isDefault) {
          const hasMedia = pose.angles.some(angle => {
            const media = angle.media as any || { images: [], files: [] }
            return (media.images && media.images.length > 0) || (media.files && media.files.length > 0)
          })

          if (hasMedia) {
            defaultPose = pose
            console.log('✅ Используем дефолтную позу с медиа:', pose.definition.name)
            break
          }
        }
      }
    }

    // 3. Если и дефолтной с медиа нет, берем первую активную с медиа
    if (!defaultPose) {
      for (const pose of character.poses) {
        const hasMedia = pose.angles.some(angle => {
          const media = angle.media as any || { images: [], files: [] }
          return (media.images && media.images.length > 0) || (media.files && media.files.length > 0)
        })

        if (hasMedia) {
          defaultPose = pose
          console.log('✅ Используем первую активную позу с медиа:', pose.definition.name)
          break
        }
      }
    }

    if (!defaultPose) {
      // Возвращаем дефолтные данные если у персонажа нет поз
      return NextResponse.json({
        poseId: 'default',
        poseName: 'Дефолтная поза',
        defaultAngle: 'front',
        angleName: 'Фронт',
        media: {
          images: [{
            id: 'default',
            url: '/images/characters/default-avatar.svg',
            filename: 'default-avatar.svg'
          }]
        },
        zones: []
      })
    }

    // Получаем ракурс: сначала активный из копии с медиа, потом первый с медиа
    let defaultAngle = null

    // 1. Пытаемся найти активный ракурс из копии с медиа (только персонализированные)
    if (activeAngleId) {
      const candidateAngle = defaultPose.angles.find(angle => angle.id === activeAngleId)
      if (candidateAngle) {
        const media = candidateAngle.media as any || { images: [], files: [] }
        if ((media.images && media.images.length > 0) || (media.files && media.files.length > 0)) {
          defaultAngle = candidateAngle
          console.log('✅ Используем активный ракурс из копии с медиа:', defaultAngle.name)
        } else {
          console.log('⚠️ У активного ракурса нет медиа, ищем другой')
        }
      }
    }

    // 2. Если не найден или нет медиа, берем первый доступный с медиа (только персонализированные)
    if (!defaultAngle) {
      for (const angle of defaultPose.angles) {
        const media = angle.media as any || { images: [], files: [] }
        if ((media.images && media.images.length > 0) || (media.files && media.files.length > 0)) {
          defaultAngle = angle
          console.log('✅ Используем первый доступный ракурс с медиа:', defaultAngle.name)
          break
        }
      }
    }

    if (!defaultAngle) {
      return NextResponse.json(
        { error: 'У позы нет доступных ракурсов' },
        { status: 404 }
      )
    }

    // Преобразуем медиа в нужный формат
    const media = defaultAngle.media as any || { images: [], files: [] }
    console.log('🔍 Медиа ракурса:', JSON.stringify(media, null, 2))

    // Поддерживаем два формата: {images: []} и {files: []}
    let formattedImages = []
    if (media.images && Array.isArray(media.images)) {
      formattedImages = media.images
    } else if (media.files && Array.isArray(media.files)) {
      // Преобразуем files в images формат
      formattedImages = media.files.map((file: any) => ({
        id: file.id,
        url: file.url,
        filename: file.filename,
        type: file.type
      }))
    }

    const formattedMedia = {
      images: formattedImages
    }
    console.log('📸 Форматированные изображения:', formattedMedia.images)

    // Если у ракурса нет медиа, возвращаем ошибку
    if (formattedMedia.images.length === 0) {
      console.log('⚠️ У ракурса нет медиа файлов, возвращаем ошибку')
      return NextResponse.json(
        { error: 'У ракурса нет доступных медиа файлов' },
        { status: 404 }
      )
    }

    // Фильтруем зоны по первому изображению
    const firstImageId = formattedMedia.images[0]?.id
    console.log('🔍 Все зоны ракурса:', defaultAngle.zones)
    console.log('🖼️ Первое изображение ID:', firstImageId)

    const filteredZones = firstImageId
      ? defaultAngle.zones.filter((zone: any) => zone.mediaFileId === firstImageId)
      : defaultAngle.zones.filter((zone: any) => !zone.mediaFileId) // Зоны без привязки к медиа

    console.log('🎯 Зоны для отображения:', {
      totalZones: defaultAngle.zones.length,
      filteredZones: filteredZones.length,
      firstImageId,
      zones: filteredZones
    })

    return NextResponse.json({
      poseId: defaultPose.definition.id,
      poseName: defaultPose.definition.name,
      defaultAngle: defaultAngle.id,
      angleName: defaultAngle.name,
      media: formattedMedia,
      zones: filteredZones
    })
  } catch (error) {
    console.error('Error fetching default pose:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
