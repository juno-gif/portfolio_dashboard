import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

const redis = Redis.fromEnv();

// GET /api/portfolio?token=xxx → CSV 텍스트 반환
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token이 필요합니다' }, { status: 400 });
  }

  const csv = await redis.get<string>(`portfolio:${token}`);
  if (!csv) {
    return NextResponse.json({ error: '데이터를 찾을 수 없습니다' }, { status: 404 });
  }

  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// POST /api/portfolio        → 신규 저장, token 발급
// POST /api/portfolio?token= → 기존 token에 덮어쓰기
export async function POST(request: NextRequest) {
  const existingToken = request.nextUrl.searchParams.get('token');
  const token = existingToken || crypto.randomUUID().replace(/-/g, '').slice(0, 20);

  const csv = await request.text();
  if (!csv.trim()) {
    return NextResponse.json({ error: 'CSV 데이터가 비어있습니다' }, { status: 400 });
  }

  // TTL 1년
  await redis.set(`portfolio:${token}`, csv, { ex: 60 * 60 * 24 * 365 });

  return NextResponse.json({ token });
}
