'use client';

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

declare global {
  interface Window { kakao: any; }
}

const COLUMN_MAP: Record<string, string> = {
  '매물종류': 'property_type',
  '거래유형': 'transaction_type',
  '주소': 'address',
  '건물명': 'building_name',
  '호수': 'unit_number',
  '보증금': 'deposit',
  '월세': 'monthly_rent',
  '매매가': 'sale_price',
  '권리금': 'premium',
  '관리비': 'maintenance_fee',
  '공급면적': 'supply_area',
  '전용면적': 'exclusive_area',
  '현재층': 'current_floor',
  '전체층': 'total_floor',
  '방향': 'direction',
  '주차': 'parking',
  '엘리베이터': 'elevator',
  '용도': 'usage_type',
  '사용승인일': 'approval_date',
  '입주가능일': 'available_date',
  '테마종류': 'theme_type',
  '설명': 'description',
  '관리자메모': 'admin_memo',
};

const NUMBER_COLS = new Set(['deposit', 'monthly_rent', 'sale_price', 'premium', 'maintenance_fee']);
const BOOL_COLS = new Set(['parking', 'elevator']);

type RowStatus = 'pending' | 'processing' | 'success' | 'error';
type ParsedRow = {
  data: Record<string, any>;
  status: RowStatus;
  error?: string;
  propertyNumber?: string;
};

export default function BulkUploadPage() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [kakaoReady, setKakaoReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initKakao = () => {
      if (typeof window.kakao?.maps?.services?.Geocoder === 'function') {
        setKakaoReady(true);
        return;
      }
      if (window.kakao?.maps?.load) {
        window.kakao.maps.load(() => setKakaoReady(true));
        return;
      }
      if (!document.querySelector('script[src*="dapi.kakao.com/v2/maps/sdk"][src*="libraries=services"]')) {
        const s = document.createElement('script');
        s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=8a478b4b6ea5e02722a33f6ac2fa34b6&autoload=false&libraries=services';
        s.async = true;
        s.onload = () => window.kakao.maps.load(() => setKakaoReady(true));
        document.head.appendChild(s);
      } else {
        const t = setInterval(() => {
          if (typeof window.kakao?.maps?.services?.Geocoder === 'function') {
            clearInterval(t);
            setKakaoReady(true);
          } else if (window.kakao?.maps?.load) {
            clearInterval(t);
            window.kakao.maps.load(() => setKakaoReady(true));
          }
        }, 200);
      }
    };
    initKakao();
  }, []);

  const parseFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const workbook = XLSX.read(buf, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const parsed: ParsedRow[] = json.map((raw) => {
      const data: Record<string, any> = {};
      for (const [koKey, val] of Object.entries(raw)) {
        const dbKey = COLUMN_MAP[String(koKey).trim()];
        if (!dbKey) continue;
        if (val === '' || val === null || val === undefined) {
          data[dbKey] = null;
          continue;
        }
        if (NUMBER_COLS.has(dbKey)) {
          const n = typeof val === 'number'
            ? val
            : parseInt(String(val).replace(/[^\d-]/g, ''), 10);
          data[dbKey] = isNaN(n) ? null : n;
        } else if (BOOL_COLS.has(dbKey)) {
          const s = String(val).trim();
          data[dbKey] = ['Y', 'y', 'TRUE', 'true', '있음', 'O', 'o', '1', '가능'].includes(s);
        } else {
          data[dbKey] = String(val).trim();
        }
      }
      return { data, status: 'pending' };
    });
    setRows(parsed);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const geocodeAddress = (addr: string): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!window.kakao?.maps?.services) {
        resolve(null);
        return;
      }
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(addr, (result: any[], status: string) => {
        if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
          resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
        } else {
          resolve(null);
        }
      });
    });
  };

  const getNextPropertyNumber = async (): Promise<number> => {
    const { data } = await supabase
      .from('properties')
      .select('property_number')
      .order('property_number', { ascending: false })
      .limit(1);
    const last = data?.[0]?.property_number;
    const lastNum = last ? parseInt(last, 10) : 10000;
    return (isNaN(lastNum) ? 10000 : lastNum) + 1;
  };

  const handleBulkInsert = async () => {
    if (rows.length === 0) {
      alert('업로드할 데이터가 없습니다.');
      return;
    }
    if (!kakaoReady) {
      alert('카카오 SDK 로딩 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!confirm(`총 ${rows.length}건을 등록하시겠습니까?`)) return;

    setIsProcessing(true);
    setProgress({ done: 0, total: rows.length });

    let nextNum = await getNextPropertyNumber();

    for (let i = 0; i < rows.length; i++) {
      setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'processing' } : r));

      const row = rows[i];
      const propertyNumber = String(nextNum);

      try {
        let latitude: number | null = null;
        let longitude: number | null = null;
        if (row.data.address) {
          const geo = await geocodeAddress(row.data.address);
          if (geo) {
            latitude = geo.lat;
            longitude = geo.lng;
          }
        }

        const insertRow: any = {
          ...row.data,
          property_number: propertyNumber,
          latitude,
          longitude,
          is_sold: false,
          status: '거래중',
        };

        const { error } = await supabase.from('properties').insert(insertRow);
        if (error) throw error;

        setRows(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'success', propertyNumber } : r
        ));
        nextNum++;
      } catch (err: any) {
        setRows(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error', error: err.message ?? String(err) } : r
        ));
      }

      setProgress(p => ({ ...p, done: i + 1 }));
    }

    setIsProcessing(false);
  };

  const statusColor = (s: RowStatus) => ({
    pending: '#999',
    processing: '#e2a06e',
    success: '#4caf50',
    error: '#f44336',
  }[s]);

  const statusLabel = (s: RowStatus) => ({
    pending: '대기중',
    processing: '처리중',
    success: '완료',
    error: '오류',
  }[s]);

  const headers = rows.length > 0
    ? Array.from(new Set(rows.flatMap(r => Object.keys(r.data))))
    : [];

  const successCount = rows.filter(r => r.status === 'success').length;
  const errorCount = rows.filter(r => r.status === 'error').length;

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '32px 24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#333' }}>엑셀 일괄 등록</h1>
          <Link href="/admin/properties/new" style={{ fontSize: '13px', color: '#e2a06e', textDecoration: 'none' }}>← 매물 등록으로</Link>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#e2a06e' : '#ccc'}`,
            background: dragOver ? '#fff6ef' : '#fff',
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px', color: '#e2a06e' }}>⬆</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
            {fileName ? fileName : '엑셀/CSV 파일을 드래그하거나 클릭하여 업로드'}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>.xlsx, .xls, .csv 지원</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{ marginTop: '16px', padding: '12px 16px', background: '#fff', borderRadius: '8px', fontSize: '12px', color: '#666', border: '1px solid #e0e0e0', lineHeight: 1.6 }}>
          <b style={{ color: '#333' }}>지원 컬럼 (엑셀 헤더):</b><br />
          {Object.keys(COLUMN_MAP).join(' / ')}
        </div>

        {rows.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#333' }}>
                총 {rows.length}건
                {isProcessing && ` — ${progress.done}/${progress.total}`}
                {!isProcessing && successCount > 0 && (
                  <span style={{ marginLeft: '12px', color: '#4caf50', fontSize: '13px' }}>완료 {successCount}건</span>
                )}
                {!isProcessing && errorCount > 0 && (
                  <span style={{ marginLeft: '8px', color: '#f44336', fontSize: '13px' }}>오류 {errorCount}건</span>
                )}
              </div>
              <button
                onClick={handleBulkInsert}
                disabled={isProcessing || !kakaoReady}
                style={{
                  padding: '10px 24px',
                  background: (isProcessing || !kakaoReady) ? '#ccc' : '#e2a06e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: (isProcessing || !kakaoReady) ? 'not-allowed' : 'pointer',
                }}
              >
                {isProcessing ? `처리중 ${progress.done}/${progress.total}` : '일괄 등록'}
              </button>
            </div>

            {isProcessing && (
              <div style={{ height: '6px', background: '#eee', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{
                  height: '100%',
                  width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`,
                  background: '#e2a06e',
                  transition: 'width 0.2s',
                }} />
              </div>
            )}

            {!kakaoReady && (
              <div style={{ padding: '10px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '6px', fontSize: '12px', color: '#876800', marginBottom: '12px' }}>
                카카오 SDK 로딩 중... 완료 후 등록 가능합니다.
              </div>
            )}

            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  <thead style={{ background: '#f8f8f8', position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontWeight: 600 }}>#</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontWeight: 600 }}>상태</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontWeight: 600 }}>매물번호</th>
                      {headers.map(h => (
                        <th key={h} style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px 10px', color: '#999' }}>{i + 1}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ color: statusColor(row.status), fontWeight: 600 }}>
                            ● {statusLabel(row.status)}
                          </span>
                          {row.error && (
                            <div style={{ fontSize: '11px', color: '#f44336', marginTop: '2px', whiteSpace: 'normal', maxWidth: '280px' }}>
                              {row.error}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#e2a06e', fontWeight: 600 }}>
                          {row.propertyNumber ?? '-'}
                        </td>
                        {headers.map(h => (
                          <td key={h} style={{ padding: '8px 10px', color: '#333', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.data[h] === null || row.data[h] === undefined || row.data[h] === '' ? '-' : String(row.data[h])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
