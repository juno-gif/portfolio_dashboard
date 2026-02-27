import Papa from 'papaparse';
import { RawHolding } from '@/types/portfolio';

const REQUIRED_COLUMNS = ['계좌', '종목명', '종목번호', '수량', '평균단가', '단위'];

export function parsePortfolioCSV(file: File): Promise<RawHolding[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];

        // 필수 컬럼 유효성 검사
        const missingColumns = REQUIRED_COLUMNS.filter(
          (col) => !headers.includes(col)
        );
        if (missingColumns.length > 0) {
          reject(
            new Error(
              `유효하지 않은 CSV 형식: 필수 컬럼 누락 - ${missingColumns.join(', ')}`
            )
          );
          return;
        }

        const holdings: RawHolding[] = [];

        for (const row of results.data as Record<string, unknown>[]) {
          const unit = String(row['단위']).trim().toUpperCase();

          // 단위가 KRW 또는 USD가 아니면 스킵
          if (unit !== 'KRW' && unit !== 'USD') {
            console.warn(`단위 값이 올바르지 않아 스킵: ${row['종목명']} (단위: ${row['단위']})`);
            continue;
          }

          holdings.push({
            계좌: String(row['계좌']).trim(),
            종목명: String(row['종목명']).trim(),
            종목번호: String(row['종목번호']).trim(),
            수량: Number(row['수량']),
            평균단가: Number(row['평균단가']),
            단위: unit as 'KRW' | 'USD',
          });
        }

        resolve(holdings);
      },
      error: (error) => {
        reject(new Error(`CSV 파싱 오류: ${error.message}`));
      },
    });
  });
}
