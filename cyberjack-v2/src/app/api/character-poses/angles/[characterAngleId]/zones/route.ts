import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// GET /api/character-poses/angles/[characterAngleId]/zones - получить активные зоны ракурса
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ characterAngleId: string }> }
) {
  try {
    const { characterAngleId } = await params

    const zones = await prisma.characterActiveZone.findMany({
      where: {
        characterAngleId
      },
      include: {
        anatomy: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      }
    })

    return NextResponse.json(zones)
  } catch (error) {
    console.error('Error fetching character active zones:', error)
    return NextResponse.json(
      { error: 'Failed to fetch character active zones' },
      { status: 500 }
    )
  }
}

// POST /api/character-poses/angles/[characterAngleId]/zones - добавить активную зону
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ characterAngleId: string }> }
) {
  try {
    const { characterAngleId } = await params
    const body = await request.json()
    const { name, anatomyDefId, mediaFileId, x, y, width, height } = body

    console.log('🔍 Создание зоны:', {
      characterAngleId,
      body,
      name,
      anatomyDefId,
      mediaFileId,
      x,
      y,
      width,
      height
    })

    if (!name || x === undefined || y === undefined || width === undefined || height === undefined) {
      console.error('❌ Отсутствуют обязательные поля:', {
        name: !!name,
        x: x !== undefined,
        y: y !== undefined,
        width: width !== undefined,
        height: height !== undefined
      })
      return NextResponse.json(
        { error: 'name, x, y, width, height are required' },
        { status: 400 }
      )
    }

    // Валидация координат и размеров
    if (x < 0 || y < 0 || width <= 0 || height <= 0) {
      console.error('❌ Невалидные координаты или размеры:', {
        x, y, width, height,
        xValid: x >= 0,
        yValid: y >= 0,
        widthValid: width > 0,
        heightValid: height > 0
      })
      return NextResponse.json(
        { error: 'Invalid coordinates or dimensions' },
        { status: 400 }
      )
    }

    // Проверяем, что ракурс персонажа существует
    const characterAngle = await prisma.characterPoseAngle.findUnique({
      where: { id: characterAngleId }
    })

    if (!characterAngle) {
      return NextResponse.json(
        { error: 'Character angle not found' },
        { status: 404 }
      )
    }

    // Создаем активную зону
    const zone = await prisma.characterActiveZone.create({
      data: {
        characterAngleId,
        name,
        anatomyDefId: anatomyDefId || null,
        mediaFileId: mediaFileId || null,
        x: Number(x),
        y: Number(y),
        width: Number(width),
        height: Number(height)
      },
      include: {
        anatomy: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      }
    })

    return NextResponse.json(zone, { status: 201 })
  } catch (error) {
    console.error('Error creating character active zone:', error)
    return NextResponse.json(
      { error: 'Failed to create character active zone' },
      { status: 500 }
    )
  }
}
