'use client';

import { useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parsePortfolioCSV } from '@/lib/csv-parser';
import { RawHolding } from '@/types/portfolio';

interface CsvUploadProps {
  onUpload: (holdings: RawHolding[]) => void;
  lastUpdated?: string;
}

export default function CsvUpload({ onUpload, lastUpdated }: CsvUploadProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setStatus('error');
      setError('CSV 파일만 업로드 가능합니다.');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const holdings = await parsePortfolioCSV(file);
      onUpload(holdings);
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'CSV 파싱 중 오류가 발생했습니다.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold mb-2">📊 포트폴리오 대시보드</h1>
        <p className="text-muted-foreground">보유종목 CSV 파일을 업로드하면 대시보드가 생성됩니다</p>
      </div>

      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <div
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/30'
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleChange}
            />
            {status === 'loading' ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">파싱 중...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="text-4xl">📂</div>
                <p className="text-sm font-medium">CSV 파일을 드래그하거나 클릭하세요</p>
                <p className="text-xs text-muted-foreground">
                  컬럼: 계좌, 종목명, 종목번호, 수량, 평균단가, 단위
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={async () => {
                setStatus('loading');
                setError('');
                try {
                  const res = await fetch('/sample.csv');
                  const text = await res.text();
                  const file = new File([text], 'sample.csv', { type: 'text/csv' });
                  const holdings = await parsePortfolioCSV(file);
                  onUpload(holdings);
                  setStatus('idle');
                } catch (e) {
                  setStatus('error');
                  setError(e instanceof Error ? e.message : '샘플 데이터 로드 중 오류가 발생했습니다.');
                }
              }}
              className="text-sm text-primary underline hover:no-underline"
            >
              샘플 데이터로 바로 보기
            </button>
          </div>

          {lastUpdated && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              마지막 업로드: {lastUpdated}
            </p>
          )}
        </CardContent>
      </Card>

      {status === 'error' && (
        <Alert variant="destructive" className="w-full max-w-lg">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground">
        CSV 컬럼 형식: <code className="bg-muted px-1 rounded">계좌,종목명,종목번호,수량,평균단가,단위</code>
      </p>
    </div>
  );
}
