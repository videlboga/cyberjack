import { NextResponse } from 'next/server'
import { loadUnifiedConfigV2 } from '@/lib/unified-config-loader'

export async function GET() {
  try {
    const config = await loadUnifiedConfigV2()
    return NextResponse.json({
      success: true,
      config,
      meta: {
        charactersCount: config.characters?.length || 0,
        usersCount: (config as any).users?.length || 0,
        equipmentCount: (config as any).equipment?.length || 0,
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}


