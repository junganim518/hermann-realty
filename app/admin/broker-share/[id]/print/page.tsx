'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Printer, ArrowLeft, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatMaintenance } from '@/lib/formatProperty';

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

const fmtTx = (tx: string | null | undefined): string => {
  if (!tx) return '-';
  return (tx === '월세' || tx === '전세') ? '임대' : tx;
};

const fmtMan = (v: number | null | undefined): string => {
  if (!v || v === 0) return '-';
  return v.toLocaleString();
};

const fmtPremium = (v: number | null | undefined): string => {
  if (!v || v === 0) return '무';
  return v.toLocaleString();
};

const shortAddr = (addr: string | null | undefined): string => {
  if (!addr) return '-';
  const m = addr.match(/(\S*동)\s+([\d-]+)/);
  if (m) return `${m[1]} ${m[2]}`;
  const dong = addr.match(/(\S*동)/);
  return dong ? dong[1] : addr.split(' ').slice(-2).join(' ');
};

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

export default function BrokerSharePrintPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params?.id as string;

  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listName, setListName] = useState('');
  const [properties, setProperties] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(`/login?redirect=/admin/broker-share/${listId}/print`); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      const [{ data: listData }, { data: items }] = await Promise.all([
        supabase.from('broker_share_lists').select('name').eq('id', listId).single(),
        supabase
          .from('broker_share_list_items')
          .select('property_id, created_at')
          .eq('list_id', listId)
          .order('created_at', { ascending: true }),
      ]);
      if (!listData) { alert('리스트를 찾을 수 없습니다.'); router.push('/admin'); return; }
      setListName(listData.name);

      const rows = items ?? [];
      if (rows.length === 0) { setProperties([]); setLoading(false); return; }

      const ids = rows.map(r => r.property_id);
      const { data: props } = await supabase
        .from('properties')
        .select('*')
        .in('id', ids)
        .is('deleted_at', null);
      const propMap = new Map<string, any>((props ?? []).map(p => [p.id, p]));

      const merged = rows
        .map(r => propMap.get(r.property_id))
        .filter(Boolean);
      setProperties(merged);
      setLoading(false);
    })();
  }, [authChecked]);

  const handleSaveImage = async () => {
    if (!sheetRef.current || properties.length === 0) return;
    setSaving(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(sheetRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      const safeName = listName.replace(/[/\\:*?"<>|]/g, '-');
      const today = new Date().toLocaleDateString('en-CA').replace(/-/g, '');
      a.href = url;
      a.download = `공동중개매물_${safeName}_${today}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  };

  if (!authChecked || loading) {
    return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</main>;
  }

  return (
    <main className="broker-print-main" style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .broker-print-main { font-family: 'Pretendard', sans-serif; }
        .broker-sheet {
          background: #fff;
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 28px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
          border-radius: 8px;
        }

        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: A4 landscape; margin: 8mm; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          header, footer, .tab-bar, .broker-print-toolbar { display: none !important; }
          .broker-print-main {
            background: #fff !important;
            padding: 0 !important;
            min-height: auto !important;
          }
          .broker-sheet {
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
        }

        .broker-table { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.45; }
        .broker-table th { background: #f3f4f6; color: #1a1a1a; font-weight: 700; padding: 8px 6px; border: 1px solid #d1d5db; text-align: center; white-space: nowrap; vertical-align: middle !important; line-height: 1.4; }
        .broker-table td { padding: 8px 6px; border: 1px solid #e5e7eb; text-align: center; vertical-align: middle !important; word-break: keep-all; line-height: 1.4; }
        .broker-table tr:nth-child(even) td { background: #fafafa; }

        @media print {
          .broker-table { font-size: 13px; }
          .broker-table thead { display: table-header-group; }
          .broker-table tr { page-break-inside: avoid; break-inside: avoid; }
        }
      ` }} />

      {/* 화면용 툴바 (인쇄 시 숨김) */}
      <div className="broker-print-toolbar" style={{ maxWidth: '1200px', margin: '0 auto 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          <ArrowLeft size={14} /> 뒤로
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={properties.length === 0 || saving}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px',
              background: properties.length === 0 || saving ? '#ccc' : '#fff',
              color: properties.length === 0 || saving ? '#fff' : '#1a1a1a',
              border: '1px solid #ddd', borderRadius: '6px',
              fontSize: '14px', fontWeight: 700,
              cursor: properties.length === 0 || saving ? 'not-allowed' : 'pointer',
            }}
          >
            <Download size={16} /> {saving ? '저장 중…' : '이미지 저장'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={properties.length === 0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px',
              background: properties.length === 0 ? '#ccc' : '#1a1a1a',
              color: properties.length === 0 ? '#fff' : '#e2a06e',
              border: 'none', borderRadius: '6px',
              fontSize: '14px', fontWeight: 700,
              cursor: properties.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            <Printer size={16} /> 인쇄
          </button>
        </div>
      </div>

      {/* 인쇄 영역 */}
      <div ref={sheetRef} className="broker-sheet">
        {/* 헤더 */}
        <div style={{ borderBottom: '2px solid #1a1a1a', paddingBottom: '12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
              {listName} <span style={{ fontSize: '14px', fontWeight: 500, color: '#888' }}>공동중개 매물 리스트</span>
            </h1>
            <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>
              총 <strong style={{ color: '#e2a06e' }}>{properties.length}개</strong>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>헤르만부동산</p>
            <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0' }}>출력일 {fmtDate(new Date().toISOString())}</p>
          </div>
        </div>

        {/* 빈 상태 또는 표 */}
        {properties.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '60px 0', color: '#888', fontSize: '14px' }}>매물이 없습니다.</p>
        ) : (
          <table className="broker-table">
            <colgroup>
              <col style={{ width: '28px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '42px' }} />
              <col style={{ width: '50px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '105px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '48px' }} />
              <col style={{ width: '48px' }} />
              <col style={{ width: '55px' }} />
              <col style={{ width: '50px' }} />
              <col style={{ width: '42px' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ verticalAlign: 'middle' }}>#</th>
                <th style={{ verticalAlign: 'middle' }}>매물번호</th>
                <th style={{ verticalAlign: 'middle' }}>거래</th>
                <th style={{ verticalAlign: 'middle' }}>종류</th>
                <th style={{ verticalAlign: 'middle' }}>상호명</th>
                <th style={{ verticalAlign: 'middle' }}>주소</th>
                <th style={{ verticalAlign: 'middle' }}>건물명</th>
                <th style={{ verticalAlign: 'middle' }}>보증금<br/>(만)</th>
                <th style={{ verticalAlign: 'middle' }}>월세<br/>(만)</th>
                <th style={{ verticalAlign: 'middle' }}>권리금<br/>(만)</th>
                <th style={{ verticalAlign: 'middle' }}>관리비</th>
                <th style={{ verticalAlign: 'middle' }}>면적</th>
                <th style={{ verticalAlign: 'middle' }}>층수</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p, idx) => (
                <tr key={p.id}>
                  <td style={{ verticalAlign: 'middle' }}>{idx + 1}</td>
                  <td style={{ verticalAlign: 'middle' }}>{p.property_number ?? '-'}</td>
                  <td style={{ verticalAlign: 'middle' }}>{fmtTx(p.transaction_type)}</td>
                  <td style={{ verticalAlign: 'middle' }}>{p.property_type ?? '-'}</td>
                  <td style={{ verticalAlign: 'middle' }}>{p.business_name?.trim() || '-'}</td>
                  <td style={{ verticalAlign: 'middle' }}>{shortAddr(p.address)}</td>
                  <td style={{ verticalAlign: 'middle' }}>{p.building_name?.trim() || '-'}</td>
                  <td style={{ verticalAlign: 'middle' }}>{fmtMan(p.deposit)}</td>
                  <td style={{ verticalAlign: 'middle' }}>{p.transaction_type === '매매' ? '-' : fmtMan(p.monthly_rent)}</td>
                  <td style={{ verticalAlign: 'middle' }}>{fmtPremium(p.premium)}</td>
                  <td style={{ verticalAlign: 'middle' }}>{formatMaintenance(p.maintenance_fee)}</td>
                  <td style={{ verticalAlign: 'middle' }}>{fmtArea(p.exclusive_area)}</td>
                  <td style={{ verticalAlign: 'middle' }}>{fmtFloor(p.current_floor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 푸터 */}
        <div style={{ marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888' }}>
          <span>📞 010-8680-8151</span>
          <span>※ 가격은 변동될 수 있으며, 자세한 정보는 담당자에게 문의 바랍니다.</span>
        </div>
      </div>
    </main>
  );
}
