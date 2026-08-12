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

const formatPrice = (v: number | null | undefined): string => {
  if (!v || v === 0) return '-';
  const uk = Math.floor(v / 10000);
  const man = v % 10000;
  if (uk > 0) return man > 0 ? `${uk}억 ${man.toLocaleString()}만` : `${uk}억`;
  return `${v.toLocaleString()}만`;
};

const buildPriceLabel = (p: any): string => {
  if (p.transaction_type === '매매') {
    return p.sale_price ? `매매 ${formatPrice(p.sale_price)}` : '-';
  }
  if (p.transaction_type === '전세') {
    return p.deposit ? `보증금 ${formatPrice(p.deposit)}` : '-';
  }
  const parts: string[] = [];
  if (p.deposit) parts.push(`보 ${formatPrice(p.deposit)}`);
  if (p.monthly_rent) parts.push(`월 ${formatPrice(p.monthly_rent)}`);
  return parts.length > 0 ? parts.join(' / ') : '-';
};

const fmtPremium = (v: number | null | undefined): string => {
  if (!v || v === 0) return '무';
  return formatPrice(v) ?? '무';
};

const shortAddr = (addr: string | null | undefined): string => {
  if (!addr) return '-';
  const m = addr.match(/(\S*동)\s+([\d-]+)/);
  if (m) return `${m[1]} ${m[2]}`;
  const dong = addr.match(/(\S*동)/);
  return dong ? dong[1] : addr.split(' ').slice(-2).join(' ');
};

const fmtArea = (sqm: string | null | undefined): string => {
  if (!sqm) return '';
  const n = parseFloat(sqm);
  if (isNaN(n) || n <= 0) return '';
  return `${(n / 3.3058).toFixed(1)}평`;
};

const fmtFloor = (floor: string | null | undefined): string => {
  if (!floor) return '';
  const s = String(floor).trim();
  return s.endsWith('층') ? s : `${s}층`;
};

const TX_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  '월세': { bg: '#fff8f2', border: '#e2a06e', text: '#c47c30' },
  '전세': { bg: '#eef4ff', border: '#4a80e8', text: '#4a80e8' },
  '매매': { bg: '#fff0f0', border: '#e05050', text: '#e05050' },
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
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#888' }}>
        로딩 중...
      </main>
    );
  }

  return (
    <main style={{ background: '#e8e8e8', minHeight: '100vh', padding: '16px 0 40px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .print-hide { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: A4 portrait; margin: 10mm; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          header, footer, .tab-bar { display: none !important; }
          main { background: #fff !important; padding: 0 !important; }
        }
      ` }} />

      {/* 화면용 툴바 */}
      <div
        className="print-hide"
        style={{
          maxWidth: '460px', margin: '0 auto 10px', padding: '0 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '7px 12px', background: '#fff', color: '#555',
            border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <ArrowLeft size={13} /> 뒤로
        </button>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={properties.length === 0 || saving}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '7px 14px',
              background: properties.length === 0 || saving ? '#ccc' : '#fff',
              color: properties.length === 0 || saving ? '#fff' : '#1a1a1a',
              border: '1px solid #ccc', borderRadius: '6px',
              fontSize: '13px', fontWeight: 700,
              cursor: properties.length === 0 || saving ? 'not-allowed' : 'pointer',
            }}
          >
            <Download size={13} /> {saving ? '저장 중…' : '이미지 저장'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={properties.length === 0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '7px 14px',
              background: properties.length === 0 ? '#ccc' : '#1a1a1a',
              color: properties.length === 0 ? '#fff' : '#e2a06e',
              border: 'none', borderRadius: '6px',
              fontSize: '13px', fontWeight: 700,
              cursor: properties.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            <Printer size={13} /> 인쇄
          </button>
        </div>
      </div>

      {/* 캡처 영역 — 460px 고정 */}
      <div
        ref={sheetRef}
        style={{
          width: '460px',
          maxWidth: '100%',
          margin: '0 auto',
          background: '#fff',
          padding: '20px 16px 24px',
          boxSizing: 'border-box',
        }}
      >
        {/* 헤더 */}
        <div style={{ borderBottom: '2px solid #1a1a1a', paddingBottom: '12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 3px' }}>
              {listName}
            </h1>
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
              공동중개 매물 &nbsp;·&nbsp; 총 <strong style={{ color: '#c47c30' }}>{properties.length}개</strong>
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 2px' }}>헤르만부동산</p>
            <p style={{ fontSize: '11px', color: '#aaa', margin: 0 }}>{fmtDate(new Date().toISOString())}</p>
          </div>
        </div>

        {/* 카드 목록 */}
        {properties.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: '#aaa', fontSize: '14px' }}>매물이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {properties.map((p, idx) => {
              const tx = TX_COLORS[p.transaction_type] ?? { bg: '#f5f5f5', border: '#ccc', text: '#666' };
              const area = fmtArea(p.exclusive_area);
              const floor = fmtFloor(p.current_floor);
              const maintenance = formatMaintenance(p.maintenance_fee);

              return (
                <div
                  key={p.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '11px 13px',
                    background: '#fff',
                  }}
                >
                  {/* 번호 + 뱃지 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#bbb' }}>#{idx + 1}</span>
                    {p.property_number && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#555' }}>{p.property_number}</span>
                    )}
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px',
                      background: tx.bg, border: `1px solid ${tx.border}`, color: tx.text,
                    }}>
                      {p.transaction_type}
                    </span>
                    {p.property_type && (
                      <span style={{
                        fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '3px',
                        background: '#f5f5f5', color: '#666', border: '1px solid #e0e0e0',
                      }}>
                        {p.property_type}
                      </span>
                    )}
                  </div>

                  {/* 상호명 */}
                  {p.business_name?.trim() && (
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a', marginBottom: '2px', lineHeight: 1.3 }}>
                      {p.business_name.trim()}
                    </div>
                  )}

                  {/* 주소 */}
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '9px' }}>
                    {shortAddr(p.address)}
                    {p.building_name?.trim() ? ` · ${p.building_name.trim()}` : ''}
                  </div>

                  {/* 가격 */}
                  <div style={{ borderTop: '1px solid #f2f2f2', paddingTop: '8px' }}>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#1a1a1a', marginBottom: '4px', letterSpacing: '-0.3px' }}>
                      {buildPriceLabel(p)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span>권리금 {fmtPremium(p.premium)}</span>
                      <span style={{ color: '#ccc' }}>|</span>
                      <span>관리비 {maintenance}</span>
                    </div>
                  </div>

                  {/* 면적 · 층수 */}
                  {(area || floor) && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#777', display: 'flex', gap: '8px' }}>
                      {area && <span>{area}</span>}
                      {area && floor && <span style={{ color: '#ccc' }}>·</span>}
                      {floor && <span>{floor}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 푸터 */}
        <div style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #eee', textAlign: 'center', fontSize: '11px', color: '#bbb' }}>
          헤르만부동산 &nbsp;·&nbsp; 📞 010-8680-8151 &nbsp;·&nbsp; 가격은 변동될 수 있습니다
        </div>
      </div>
    </main>
  );
}
