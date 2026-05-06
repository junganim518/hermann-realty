'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatMaintenance } from '@/lib/formatProperty';

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

// 거래유형: 월세/전세 → 임대 통합
const fmtTx = (tx: string | null | undefined): string => {
  if (!tx) return '-';
  return (tx === '월세' || tx === '전세') ? '임대' : tx;
};

// 만원 단위 숫자 → 천 단위 콤마 (예: 3000 → "3,000")
const fmtMan = (v: number | null | undefined): string => {
  if (!v || v === 0) return '-';
  return v.toLocaleString();
};

// 권리금: 0/null → "무"
const fmtPremium = (v: number | null | undefined): string => {
  if (!v || v === 0) return '무';
  return v.toLocaleString();
};

// 주소 간략화: "동 번지" 또는 "구 동" 정도
const shortAddr = (addr: string | null | undefined): string => {
  if (!addr) return '-';
  // "경기도 부천시 원미구 중동 1142-7" → "중동 1142-7"
  // 마지막 동 이후 부분 추출
  const m = addr.match(/(\S*동)\s+([\d-]+)/);
  if (m) return `${m[1]} ${m[2]}`;
  // 동만이라도 추출
  const dong = addr.match(/(\S*동)/);
  return dong ? dong[1] : addr.split(' ').slice(-2).join(' ');
};

// 전용 면적 → 평수 표시
const fmtArea = (sqm: string | null | undefined): string => {
  if (!sqm) return '-';
  const n = parseFloat(sqm);
  if (isNaN(n) || n <= 0) return '-';
  return `${(n / 3.3058).toFixed(1)}평`;
};

const fmtFloor = (floor: string | null | undefined): string => {
  if (!floor) return '-';
  const s = String(floor).trim();
  return s.endsWith('층') ? s : `${s}층`;
};

export default function CustomerPickPrintPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params?.id as string;

  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [picks, setPicks] = useState<Array<{ property: any; reason_memo: string }>>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(`/login?redirect=/admin/customers/${customerId}/print`); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      const [{ data: customerData }, { data: recsRows }] = await Promise.all([
        supabase.from('customers').select('*').eq('id', customerId).single(),
        supabase
          .from('customer_recommendations')
          .select('property_id, reason_memo, created_at')
          .eq('customer_id', customerId)
          .eq('is_recommended', true)
          .order('created_at', { ascending: true }),
      ]);
      if (!customerData) { alert('손님 정보를 찾을 수 없습니다.'); router.push('/admin/customers'); return; }
      setCustomer(customerData);

      const rows = recsRows ?? [];
      if (rows.length === 0) { setPicks([]); setLoading(false); return; }

      const ids = rows.map(r => r.property_id);
      const { data: props } = await supabase.from('properties').select('*').in('id', ids);
      const propMap = new Map<string, any>((props ?? []).map(p => [p.id, p]));

      // 픽 순서대로 매핑 (DB 매물 누락된 픽은 제외)
      const merged = rows
        .map(r => ({ property: propMap.get(r.property_id), reason_memo: r.reason_memo ?? '' }))
        .filter(x => !!x.property);
      setPicks(merged);
      setLoading(false);
    })();
  }, [authChecked]);

  const handlePrint = () => {
    window.print();
  };

  if (!authChecked || loading) {
    return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</main>;
  }

  return (
    <main className="pick-print-main" style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        /* 화면용 컨테이너 */
        .pick-print-main { font-family: 'Pretendard', sans-serif; }
        .pick-sheet {
          background: #fff;
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 28px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
          border-radius: 8px;
        }

        /* 인쇄 모드 */
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: A4 landscape; margin: 8mm; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }

          /* 사이트 UI 전부 숨김 */
          header, footer, .tab-bar, .pick-print-toolbar { display: none !important; }

          /* 메인 컨테이너 풀블리드 */
          .pick-print-main {
            background: #fff !important;
            padding: 0 !important;
            min-height: auto !important;
          }
          .pick-sheet {
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
        }

        /* 표 디자인 */
        .pick-table { width: 100%; border-collapse: collapse; font-size: 11px; line-height: 1.4; }
        .pick-table th { background: #f3f4f6; color: #1a1a1a; font-weight: 700; padding: 6px 4px; border: 1px solid #d1d5db; text-align: center; white-space: nowrap; }
        .pick-table td { padding: 6px 4px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle; word-break: keep-all; }
        .pick-table td.memo-cell { text-align: left; }
        .pick-table tr:nth-child(even) td { background: #fafafa; }

        @media print {
          .pick-table { font-size: 10px; }
          .pick-table thead { display: table-header-group; }
          .pick-table tr { page-break-inside: avoid; }
        }
      ` }} />

      {/* 화면용 툴바 (인쇄 시 숨김) */}
      <div className="pick-print-toolbar" style={{ maxWidth: '1200px', margin: '0 auto 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          <ArrowLeft size={14} /> 뒤로
        </button>
        <button
          type="button"
          onClick={handlePrint}
          disabled={picks.length === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '10px 18px',
            background: picks.length === 0 ? '#ccc' : '#1a1a1a',
            color: picks.length === 0 ? '#fff' : '#e2a06e',
            border: 'none', borderRadius: '6px',
            fontSize: '14px', fontWeight: 700,
            cursor: picks.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <Printer size={16} /> 인쇄
        </button>
      </div>

      {/* 인쇄 영역 */}
      <div className="pick-sheet">
        {/* 헤더 */}
        <div style={{ borderBottom: '2px solid #1a1a1a', paddingBottom: '12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
              {customer?.name ?? '손님'} <span style={{ fontSize: '14px', fontWeight: 500, color: '#888' }}>맞춤 매물 리스트</span>
            </h1>
            <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>
              총 <strong style={{ color: '#e2a06e' }}>{picks.length}개</strong>
              {customer?.phone && <span style={{ marginLeft: '12px' }}>· 연락처 {customer.phone}</span>}
              {customer?.region && <span style={{ marginLeft: '12px' }}>· 관심 지역 {customer.region}</span>}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>헤르만부동산</p>
            <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0' }}>출력일 {fmtDate(new Date().toISOString())}</p>
          </div>
        </div>

        {/* 빈 상태 또는 표 */}
        {picks.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '60px 0', color: '#888', fontSize: '14px' }}>픽한 매물이 없습니다.</p>
        ) : (
          <table className="pick-table">
            <colgroup>
              <col style={{ width: '32px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '46px' }} />
              <col style={{ width: '54px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '52px' }} />
              <col style={{ width: '52px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '54px' }} />
              <col style={{ width: '40px' }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>매물번호</th>
                <th>거래</th>
                <th>종류</th>
                <th>상호명</th>
                <th>주소</th>
                <th>보증금<br/>(만)</th>
                <th>월세<br/>(만)</th>
                <th>권리금<br/>(만)</th>
                <th>관리비</th>
                <th>면적</th>
                <th>층수</th>
                <th>메모 / 추천이유</th>
              </tr>
            </thead>
            <tbody>
              {picks.map(({ property: p, reason_memo }, idx) => {
                const memoParts = [p.admin_memo?.trim(), reason_memo?.trim()].filter(Boolean);
                const memoCell = memoParts.length > 0 ? memoParts.join(' / ') : '-';
                return (
                  <tr key={p.id}>
                    <td>{idx + 1}</td>
                    <td>{p.property_number ?? '-'}</td>
                    <td>{fmtTx(p.transaction_type)}</td>
                    <td>{p.property_type ?? '-'}</td>
                    <td>{p.business_name?.trim() || '-'}</td>
                    <td style={{ fontSize: '10px' }}>{shortAddr(p.address)}</td>
                    <td>{fmtMan(p.deposit)}</td>
                    <td>{p.transaction_type === '매매' ? '-' : fmtMan(p.monthly_rent)}</td>
                    <td>{fmtPremium(p.premium)}</td>
                    <td>{formatMaintenance(p.maintenance_fee)}</td>
                    <td>{fmtArea(p.exclusive_area)}</td>
                    <td>{fmtFloor(p.current_floor)}</td>
                    <td className="memo-cell" style={{ fontSize: '10px', color: '#444' }} title={memoCell}>{memoCell}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* 푸터 */}
        <div style={{ marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888' }}>
          <span>📞 010-8680-8151</span>
          <span>※ 가격은 변동될 수 있으며, 자세한 정보는 사장님께 문의 바랍니다.</span>
        </div>
      </div>
    </main>
  );
}
