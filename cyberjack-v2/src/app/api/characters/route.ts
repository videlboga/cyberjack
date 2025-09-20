import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { copyFile, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function GET() {
  try {
    const characters = await prisma.character.findMany({
      include: {
        characteristics: {
          include: {
            definition: true
          }
        },
        anatomy: {
          include: {
            definition: true
          }
        },
        poses: {
          include: {
            definition: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(characters)
  } catch (error) {
    console.error('Error fetching characters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch characters' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, age, avatar, price = 500, isActive = true } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      // Создаем персонажа
      const character = await tx.character.create({
        data: {
          name,
          description,
          age,
          avatar,
          price,
          isActive
        }
      })

      // Если аватар - временный файл, перемещаем его в постоянную папку
      let finalAvatarUrl = avatar
      if (avatar && avatar.startsWith('/uploads/temp/avatars/')) {
        try {
          const tempPath = join(process.cwd(), 'public', avatar)
          const permanentDir = join(process.cwd(), 'public', 'uploads', 'characters', character.id)
          const extension = avatar.split('.').pop()
          const permanentFilename = `${character.id}_avatar.${extension}`
          const permanentPath = join(permanentDir, permanentFilename)

          // Создаем директорию для персонажа
          if (!existsSync(permanentDir)) {
            const { mkdir } = await import('fs/promises')
            await mkdir(permanentDir, { recursive: true })
          }

          // Копируем файл
          await copyFile(tempPath, permanentPath)

          // Удаляем временный файл
          await unlink(tempPath)

          // Обновляем URL аватара
          finalAvatarUrl = `/uploads/characters/${character.id}/${permanentFilename}`

          // Обновляем персонажа с новым URL аватара
          await tx.character.update({
            where: { id: character.id },
            data: { avatar: finalAvatarUrl }
          })
        } catch (fileError) {
          console.error('Error moving avatar file:', fileError)
          // Продолжаем без аватара, если не удалось переместить файл
        }
      }

      // Получаем все активные определения характеристик
      const characteristicDefinitions = await tx.characteristicDefinition.findMany({
        where: { isActive: true }
      })

      // Создаем характеристики для персонажа
      if (characteristicDefinitions.length > 0) {
        await tx.characteristic.createMany({
          data: characteristicDefinitions.map(def => ({
            characterId: character.id,
            characteristicDefId: def.id,
            currentValue: 50, // Значение по умолчанию
            baseValue: 50,
            recoveryRate: 1.0
          }))
        })
      }

      return { ...character, avatar: finalAvatarUrl }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating character:', error)
    return NextResponse.json(
      { error: 'Failed to create character' },
      { status: 500 }
    )
  }
}
