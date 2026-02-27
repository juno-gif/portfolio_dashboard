import { NextResponse } from 'next/server';

const FALLBACK_RATE = 1370;

export async function GET() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error(`환율 API 응답 오류: ${res.status}`);

    const data = await res.json();
    const rate: number = data?.rates?.KRW ?? FALLBACK_RATE;

    return NextResponse.json({
      rate,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('환율 조회 실패, fallback 사용:', error);
    return NextResponse.json({
      rate: FALLBACK_RATE,
      timestamp: new Date().toISOString(),
      fallback: true,
    });
  }
}
