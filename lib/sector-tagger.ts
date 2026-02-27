import { RawHolding, SectorKey } from '@/types/portfolio';

// 섹터별 키워드 규칙 (우선순위 순서대로 체크)
const SECTOR_RULES: { sector: SectorKey; keywords: string[] }[] = [
  {
    sector: '금',
    keywords: ['금현물', 'KRX금', 'GOLD'],
  },
  {
    sector: '채권/혼합',
    keywords: ['채권', '국채', '혼합', '금채'],
  },
  {
    sector: '방산/테마',
    keywords: ['방산', '조선', '2차전지', '반도체', 'K방산'],
  },
  {
    sector: '해외기타',
    keywords: ['유로', '유럽', '신흥국'],
  },
  {
    sector: '미국지수',
    keywords: ['미국', 'S&P', '나스닥', 'NASDAQ', 'QQQ', 'DIA', 'SPY', '다우', '1Q '],
  },
  {
    sector: '국내지수',
    keywords: ['코스피', '코스닥', 'KOSPI', ' 200', '코스피50', '코스닥150'],
  },
];

export function tagSector(holding: RawHolding): SectorKey {
  const name = holding.종목명;

  // 우선순위에 따라 순서대로 키워드 매칭 (대소문자 무시)
  for (const rule of SECTOR_RULES) {
    for (const keyword of rule.keywords) {
      if (name.toLowerCase().includes(keyword.toLowerCase())) {
        return rule.sector;
      }
    }
  }

  // 키워드 미매칭 시: USD면 미국지수, KRW면 개별주
  if (holding.단위 === 'USD') {
    return '미국지수';
  }

  return '개별주';
}
