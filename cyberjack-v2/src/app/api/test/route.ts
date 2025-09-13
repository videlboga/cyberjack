import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'API работает!',
    timestamp: new Date().toISOString(),
    status: 'success'
  })
}

export async function POST() {
  return NextResponse.json({
    message: 'POST запрос работает!',
    timestamp: new Date().toISOString(),
    status: 'success'
  })
}

