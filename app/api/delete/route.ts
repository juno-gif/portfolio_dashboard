import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

const redis = Redis.fromEnv();

// DELETE /api/delete?token=xxx → 해당 토큰의 모든 KV 데이터 삭제
export async function DELETE(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token이 필요합니다' }, { status: 400 });
  }

  await Promise.all([
    redis.del(`portfolio:${token}`),
    redis.del(`misc:${token}`),
    redis.del(`sector:${token}`),
    redis.del(`projection:${token}`),
  ]);

  return NextResponse.json({ ok: true });
}
