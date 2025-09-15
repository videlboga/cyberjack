import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params

    // Получаем персонажа с его позами
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        poses: {
          where: { isActive: true },
          include: {
            definition: {
              include: {
                angles: {
                  include: {
                    zones: true
                  }
                }
              }
            },
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

    // Ищем дефолтную позу (помеченную как isDefault)
    console.log('🔍 Ищем дефолтную позу для персонажа:', characterId)
    console.log('📋 Доступные позы:', character.poses.map(p => ({ id: p.id, name: p.definition.name, isDefault: p.isDefault })))

    let defaultPose = character.poses.find(pose => pose.isDefault)

    // Если нет дефолтной позы, берем первую активную
    if (!defaultPose) {
      console.log('⚠️ Дефолтная поза не найдена, берем первую активную')
      defaultPose = character.poses[0]
    } else {
      console.log('✅ Найдена дефолтная поза:', defaultPose.definition.name)
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

    // Получаем дефолтный ракурс (первый доступный)
    const defaultAngle = defaultPose.angles[0] || defaultPose.definition.angles[0]

    if (!defaultAngle) {
      return NextResponse.json(
        { error: 'У позы нет доступных ракурсов' },
        { status: 404 }
      )
    }

    // Преобразуем медиа в нужный формат
    const media = defaultAngle.media as any || { files: [] }
    const formattedMedia = {
      images: media.files?.filter((file: any) => file.type === 'image') || []
    }

    return NextResponse.json({
      poseId: defaultPose.definition.id,
      poseName: defaultPose.definition.name,
      defaultAngle: defaultAngle.id,
      angleName: defaultAngle.name,
      media: formattedMedia,
      zones: defaultAngle.zones
    })
  } catch (error) {
    console.error('Error fetching default pose:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
