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
      setProperties(rows.map(r => propMap.get(r.property_id)).filter(Boolean));
      setLoading(false);
    })();
  }, [authChecked]);

  const handleSaveImage = async () => {
    if (!sheetRef.current || properties.length === 0) return;
    setSaving(true);

    const sheet = sheetRef.current;
    const wrapEl = sheet.querySelector('.broker-sheet-table-wrap') as HTMLElement | null;
    const tableEl = sheet.querySelector('.broker-table') as HTMLElement | null;

    // 모바일: overflow-x:auto wrapper 안 표가 sheet보다 넓으면
    // 캡처 전 sheet를 표 실제 폭으로 임시 확장해 우측 잘림 방지
    const tableScrollW = tableEl?.scrollWidth ?? 0;
    const sheetClientW = sheet.clientWidth;
    const needsExpand = tableScrollW > sheetClientW;

    const saved = {
      wrapOverflow: wrapEl?.style.overflowX ?? '',
      sheetMaxWidth: sheet.style.maxWidth,
      sheetWidth: sheet.style.width,
    };

    if (needsExpand && wrapEl) {
      const cs = getComputedStyle(sheet);
      const padH = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      wrapEl.style.overflowX = 'visible';
      sheet.style.maxWidth = 'none';
      sheet.style.width = `${tableScrollW + padH}px`;
    }

    // 확장 후 실제 렌더 높이 읽기 (reflow 반영)
    const trEls = Array.from(sheet.querySelectorAll('tr')) as HTMLElement[];
    const trHeights = trEls.map(tr => tr.getBoundingClientRect().height);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(sheet, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc, clonedEl) => {
          const clonedTrs = Array.from(clonedEl.querySelectorAll('tr')) as HTMLElement[];
          clonedTrs.forEach((tr, i) => {
            if (trHeights[i] != null) tr.style.height = `${trHeights[i]}px`;
          });
          const cells = Array.from(
            clonedEl.querySelectorAll('.broker-table th, .broker-table td')
          ) as HTMLElement[];
          cells.forEach(cell => {
            const tr = cell.closest('tr') as HTMLElement | null;
            const h = tr?.style.height || '';
            cell.style.padding = '0';
            const span = clonedDoc.createElement('span');
            span.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:100%;height:${h};padding:0 6px;box-sizing:border-box;`;
            span.innerHTML = cell.innerHTML;
            cell.innerHTML = '';
            cell.appendChild(span);
          });
        },
      });

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      const safeName = listName.replace(/[/\\:*?"<>|]/g, '-');
      const today = new Date().toLocaleDateString('en-CA').replace(/-/g, '');
      a.href = url;
      a.download = `공동중개매물_${safeName}_${today}.png`;
      a.click();
    } finally {
      // 성공/실패 모두 DOM 복원
      if (needsExpand && wrapEl) {
        wrapEl.style.overflowX = saved.wrapOverflow;
        sheet.style.maxWidth = saved.sheetMaxWidth;
        sheet.style.width = saved.sheetWidth;
      }
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

        /* ── 표 기본 (데스크톱) ── */
        .broker-table { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.45; }
        .broker-table th {
          background: #f3f4f6; color: #1a1a1a; font-weight: 700;
          padding: 8px 6px; border: 1px solid #d1d5db;
          text-align: center; white-space: nowrap;
          vertical-align: middle !important; line-height: 1.4;
        }
        .broker-table td {
          padding: 8px 6px; border: 1px solid #e5e7eb;
          text-align: center; vertical-align: middle !important;
          word-break: keep-all; line-height: 1.4;
        }
        .broker-table tr:nth-child(even) td { background: #fafafa; }

        /* ── 모바일 (≤ 768px): 글씨/여백 축소 + 가로 스크롤 허용 ── */
        @media (max-width: 768px) {
          .broker-print-main { padding: 10px; }
          .broker-sheet { padding: 14px 10px; border-radius: 6px; }
          .broker-sheet-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .broker-table { font-size: 10px; table-layout: auto; }
          .broker-table th { padding: 5px 3px; }
          .broker-table td { padding: 5px 3px; }
          .broker-print-toolbar { padding: 0 4px; }

          /* 헤더: 좌우 → 위아래 스택, 텍스트 축소 */
          .broker-sheet-header-inner { flex-direction: column; align-items: flex-start; gap: 6px; }
          .broker-sheet-header-inner > div:last-child { text-align: left; }
          .broker-sheet-header h1 { font-size: 14px; }
          .broker-sheet-header h1 span { font-size: 11px; }
          .broker-sheet-header p { font-size: 11px; }
          .broker-sheet-header-right p:first-child { font-size: 12px; }
          .broker-sheet-header-right p:last-child  { font-size: 10px; }

          /* 푸터: 좌우 → 위아래 스택 */
          .broker-sheet-footer { flex-direction: column; gap: 2px; }
        }

        /* ── 인쇄 ── */
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: A4 landscape; margin: 8mm; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          header, footer, .tab-bar, .broker-print-toolbar { display: none !important; }
          .broker-print-main { background: #fff !important; padding: 0 !important; min-height: auto !important; }
          .broker-sheet {
            box-shadow: none !important; border-radius: 0 !important;
            padding: 0 !important; max-width: 100% !important; margin: 0 !important;
          }
          .broker-sheet-table-wrap { overflow-x: visible; }
          .broker-table { font-size: 13px; table-layout: fixed; }
          .broker-table th { padding: 8px 6px; }
          .broker-table td { padding: 8px 6px; }
          .broker-table thead { display: table-header-group; }
          .broker-table tr { page-break-inside: avoid; break-inside: avoid; }
        }
      ` }} />

      {/* 툴바 */}
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

      {/* 캡처 영역 */}
      <div ref={sheetRef} className="broker-sheet">
        {/* 헤더 */}
        <div className="broker-sheet-header" style={{ borderBottom: '2px solid #1a1a1a', paddingBottom: '12px', marginBottom: '14px' }}>
          <div className="broker-sheet-header-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
                {listName} <span style={{ fontSize: '14px', fontWeight: 500, color: '#888' }}>공동중개 매물 리스트</span>
              </h1>
              <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>
                총 <strong style={{ color: '#e2a06e' }}>{properties.length}개</strong>
              </p>
            </div>
            <div className="broker-sheet-header-right" style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a', margin: 0, whiteSpace: 'nowrap' }}>헤르만부동산</p>
              <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0', whiteSpace: 'nowrap' }}>출력일 {fmtDate(new Date().toISOString())}</p>
            </div>
          </div>
        </div>

        {/* 표 */}
        {properties.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '60px 0', color: '#888', fontSize: '14px' }}>매물이 없습니다.</p>
        ) : (
          <div className="broker-sheet-table-wrap">
            <table className="broker-table">
              <colgroup>
                <col style={{ width: '28px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '150px' }} />
                <col style={{ width: '65px' }} />
                <col style={{ width: '55px' }} />
                <col style={{ width: '55px' }} />
                <col style={{ width: '60px' }} />
                <col style={{ width: '55px' }} />
                <col style={{ width: '45px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ verticalAlign: 'middle' }}>#</th>
                  <th style={{ verticalAlign: 'middle' }}>주소</th>
                  <th style={{ verticalAlign: 'middle' }}>상호명</th>
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
                    <td style={{ verticalAlign: 'middle' }}>{shortAddr(p.address)}</td>
                    <td style={{ verticalAlign: 'middle' }}>{p.business_name?.trim() || '-'}</td>
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
          </div>
        )}

        {/* 푸터 */}
        <div className="broker-sheet-footer" style={{ marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888' }}>
          <span style={{ whiteSpace: 'nowrap' }}>📞 010-8680-8151</span>
          <span>※ 가격은 변동될 수 있으며, 자세한 정보는 담당자에게 문의 바랍니다.</span>
        </div>
      </div>
    </main>
  );
}
