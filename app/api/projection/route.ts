import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

const redis = new Redis({ url: process.env.PORTFOLIO_KV_REST_API_URL, token: process.env.PORTFOLIO_KV_REST_API_TOKEN });

// GET /api/projection?token=xxx → 저장된 예측 파라미터 JSON 반환
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token이 필요합니다' }, { status: 400 });
  }

  const data = await redis.get(`projection:${token}`);
  if (!data) {
    return NextResponse.json({ error: '데이터를 찾을 수 없습니다' }, { status: 404 });
  }

  // Upstash는 JSON을 자동 파싱해서 object로 반환할 수 있으므로 항상 NextResponse.json 사용
  return NextResponse.json(typeof data === 'string' ? JSON.parse(data) : data);
}

// POST /api/projection?token=xxx → 예측 파라미터 저장 (포트폴리오 토큰과 동일한 값 사용)
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token이 필요합니다' }, { status: 400 });
  }

  const body = await request.text();
  if (!body.trim()) {
    return NextResponse.json({ error: '데이터가 비어있습니다' }, { status: 400 });
  }

  // 포트폴리오와 동일한 TTL 1년
  await redis.set(`projection:${token}`, body, { ex: 60 * 60 * 24 * 365 });

  return NextResponse.json({ ok: true });
}
