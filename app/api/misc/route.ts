import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

const redis = Redis.fromEnv();

// GET /api/misc?token=xxx → 저장된 기타 자산 JSON 반환
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token이 필요합니다' }, { status: 400 });
  }

  const data = await redis.get(`misc:${token}`);
  if (!data) {
    return NextResponse.json({ error: '데이터를 찾을 수 없습니다' }, { status: 404 });
  }

  return NextResponse.json(typeof data === 'string' ? JSON.parse(data) : data);
}

// POST /api/misc?token=xxx → 기타 자산 저장
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token이 필요합니다' }, { status: 400 });
  }

  const body = await request.text();
  if (!body.trim()) {
    return NextResponse.json({ error: '데이터가 비어있습니다' }, { status: 400 });
  }

  await redis.set(`misc:${token}`, body, { ex: 60 * 60 * 24 * 365 });

  return NextResponse.json({ ok: true });
}
