import { SectorDef } from '@/types/portfolio';

export const DEFAULT_SECTORS: SectorDef[] = [
  { name: '미국지수',  color: '#3B82F6' },
  { name: '국내지수',  color: '#10B981' },
  { name: '금',        color: '#F59E0B' },
  { name: '방산/테마', color: '#EF4444' },
  { name: '채권/혼합', color: '#8B5CF6' },
  { name: '해외기타',  color: '#06B6D4' },
  { name: '개별주',    color: '#F97316' },
  { name: '기타',      color: '#6B7280' },
];

export function getSectorColor(name: string, sectors: SectorDef[]): string {
  return sectors.find((s) => s.name === name)?.color ?? '#6B7280';
}
