'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Trash2, Plus, ArrowLeft, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  effectiveStatus,
  getStatusColors,
  getDDayInfo,
  formatContractPrice,
  formatPeriod,
  type ContractType,
  type ContractStatus,
} from '@/lib/contracts';
import { formatPropertyTitle } from '@/lib/landlordDisplay';

export default function LandlordDetailPage() {
  const router = useRouter();
  const params = useParams();
  const landlordId = params?.id as string;

  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [propertyMap, setPropertyMap] = useState<Record<string, any>>({});
  const [directPropIds, setDirectPropIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(`/login?redirect=/admin/landlords/${landlordId}`); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      console.log('[임대인상세] 시작 — landlordId:', landlordId);
      // properties 테이블 실제 컬럼만: deposit/monthly_rent/premium (sale_price 컬럼 없음 — 매매가는 deposit에 저장)
      const propertyCols = 'id, property_number, address, building_name, unit_number, property_type, transaction_type, deposit, monthly_rent, premium, is_sold, landlord_id';

      // 1) 임대인 + 계약 조회
      const [landlordResp, contractsResp] = await Promise.all([
        supabase.from('landlords').select('*').eq('id', landlordId).single(),
        supabase.from('contracts').select('*').eq('landlord_id', landlordId).order('created_at', { ascending: false }),
      ]);
      const { data: l } = landlordResp;
      const { data: cs, error: contractsErr } = contractsResp;
      if (contractsErr) console.error('[임대인상세] contracts 조회 에러:', contractsErr);
      if (!l) { alert('임대인을 찾을 수 없습니다.'); router.push('/admin/landlords'); return; }
      setLandlord(l);
      setContracts(cs ?? []);

      // 2) properties.landlord_id로 직접 연결된 매물
      const { data: directProps, error: directErr } = await supabase
        .from('properties')
        .select(propertyCols)
        .eq('landlord_id', landlordId);
      if (directErr) console.error('[임대인상세] direct properties 조회 에러:', directErr);
      console.log('[임대인상세] direct properties:', directProps);

      // 3) 계약에서 참조된 매물
      const map: Record<string, any> = {};
      const contractPropIds = Array.from(new Set((cs ?? []).map(c => c.property_id).filter(Boolean)));
      if (contractPropIds.length > 0) {
        const { data: contractProps, error: contractPropsErr } = await supabase
          .from('properties')
          .select(propertyCols)
          .in('id', contractPropIds);
        if (contractPropsErr) console.error('[임대인상세] contract properties 조회 에러:', contractPropsErr);
        console.log('[임대인상세] contract properties:', contractProps);
        (contractProps ?? []).forEach(p => { map[p.id] = p; });
      }

      // 4) 직접 연결 매물 합치기 (중복 제거)
      (directProps ?? []).forEach(p => { if (!map[p.id]) map[p.id] = p; });

      const directIds = new Set((directProps ?? []).map(p => p.id));
      console.log('[임대인상세] propertyMap:', map);
      console.log('[임대인상세] directPropIds:', Array.from(directIds));

      setPropertyMap(map);
      setDirectPropIds(directIds);
      setLoading(false);
    })();
  }, [authChecked]);

  const handleDelete = async () => {
    if (!confirm(`"${landlord?.name}" 임대인을 삭제하시겠습니까? (계약은 유지되고 참조만 끊깁니다)`)) return;
    const { error } = await supabase.from('landlords').delete().eq('id', landlordId);
    if (error) { alert(`삭제 실패: ${error.message}`); return; }
    alert('삭제되었습니다.');
    router.push('/admin/landlords');
  };

  if (!authChecked || loading) return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</main>;
  if (!landlord) return null;

  const labelTextSt: React.CSSProperties = { fontSize: '12px', color: '#888', fontWeight: 500, marginBottom: '2px' };
  const valueTextSt: React.CSSProperties = { fontSize: '14px', color: '#1a1a1a', fontWeight: 500 };
  const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', marginBottom: '16px' };
  const sectionTitleSt: React.CSSProperties = { fontSize: '17px', fontWeight: 700, color: '#1a1a1a', marginBottom: '14px', paddingBottom: '8px', borderBottom: '2px solid #e2a06e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };

  // 보유 매물:
  // 1) 진행중 계약(종료/재계약 제외)에 연결된 매물
  // 2) properties.landlord_id로 직접 연결된 매물
  // 두 경로를 합쳐 중복 제거 — 종료된 계약의 매물은 제외
  const heldIds = new Set<string>();
  contracts
    .filter(c => c.property_id && c.status !== '종료' && c.status !== '재계약')
    .forEach(c => heldIds.add(c.property_id));
  directPropIds.forEach(id => heldIds.add(id));
  const propertiesHeld = Array.from(heldIds).map(id => propertyMap[id]).filter(Boolean);

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px 16px 60px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/admin/landlords')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
              <ArrowLeft size={14} /> 임대인 목록
            </button>
            <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>👤 {landlord.name}</h1>
            {landlord.phone && <span style={{ fontSize: '13px', color: '#666' }}>{landlord.phone}</span>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href={`/admin/landlords/${landlordId}/edit`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 14px', background: '#1a1a1a', color: '#e2a06e', borderRadius: '6px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              <Pencil size={14} /> 수정
            </Link>
            <button onClick={handleDelete} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 14px', background: '#fff', color: '#e05050', border: '1px solid #e05050', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        </div>

        {/* 기본 정보 — 부가 정보로 축소 (이메일/사업자번호 row 제거) */}
        {(landlord.property_address || landlord.address || landlord.memo) && (
          <div style={sectionSt}>
            <h2 style={sectionTitleSt}><span>👤 기본 정보</span></h2>
            {landlord.property_address && (
              <div style={{ marginBottom: (landlord.address || landlord.memo) ? '12px' : 0 }}>
                <div style={labelTextSt}>건물/호수</div>
                <div style={valueTextSt}>{landlord.property_address}</div>
              </div>
            )}
            {landlord.address && (
              <div style={{ paddingTop: landlord.property_address ? '12px' : 0, borderTop: landlord.property_address ? '1px solid #f0f0f0' : 'none', marginBottom: landlord.memo ? '12px' : 0 }}>
                <div style={labelTextSt}>주소</div>
                <div style={valueTextSt}>{landlord.address}</div>
              </div>
            )}
            {landlord.memo && (
              <div style={{ paddingTop: (landlord.property_address || landlord.address) ? '12px' : 0, borderTop: (landlord.property_address || landlord.address) ? '1px solid #f0f0f0' : 'none' }}>
                <div style={labelTextSt}>메모</div>
                <p style={{ fontSize: '13px', color: '#333', whiteSpace: 'pre-line', margin: '4px 0 0', lineHeight: 1.6 }}>{landlord.memo}</p>
              </div>
            )}
          </div>
        )}

        {/* 보유 매물 — 메인 콘텐츠로 강조 */}
        <div style={{ ...sectionSt, padding: '24px', border: '2px solid #e2a06e' }}>
          <h2 style={{ ...sectionTitleSt, fontSize: '20px' }}>
            <span>📍 보유 매물 ({propertiesHeld.length})</span>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>매물 직접 연결 + 진행중 계약</span>
          </h2>
          {propertiesHeld.length === 0 ? (
            <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>보유 매물이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {propertiesHeld.map(p => {
                // 가격 표시
                const priceStr = (() => {
                  // properties 테이블엔 sale_price 컬럼 없음 — 매매가는 deposit에 저장됨
                  if (p.transaction_type === '매매') {
                    return p.deposit ? `매매 ${p.deposit.toLocaleString()}만` : '-';
                  }
                  if (p.transaction_type === '전세') {
                    return p.deposit ? `전세 ${p.deposit.toLocaleString()}만` : '-';
                  }
                  const parts: string[] = [];
                  if (p.deposit) parts.push(`보 ${p.deposit.toLocaleString()}`);
                  if (p.monthly_rent) parts.push(`월 ${p.monthly_rent.toLocaleString()}`);
                  return parts.length > 0 ? parts.join(' / ') : '-';
                })();
                const txColors: Record<string, { bg: string; color: string }> = {
                  '월세': { bg: '#fff8f2', color: '#e2a06e' },
                  '전세': { bg: '#eef4ff', color: '#4a80e8' },
                  '매매': { bg: '#fff0f0', color: '#e05050' },
                };
                const tx = p.transaction_type ? (txColors[p.transaction_type] ?? { bg: '#f5f5f5', color: '#999' }) : null;
                const propTitle = formatPropertyTitle(p);
                return (
                  <a
                    key={p.id}
                    href={`/item/view/${p.property_number}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'block', padding: '14px 16px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '6px', textDecoration: 'none', color: '#1a1a1a', opacity: p.is_sold ? 0.65 : 1 }}
                  >
                    {/* 메인: 매물 식별 정보 (주소 + 건물명 + 호수) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <MapPin size={14} color="#e2a06e" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>{propTitle || '-'}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#e2a06e', fontWeight: 600 }}>매물 보기 →</span>
                    </div>
                    {/* 부가: 매물번호 + 거래유형 + 가격 + 상태 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: '#888' }}>#{p.property_number ?? '-'}</span>
                      {p.property_type && (
                        <span style={{ fontSize: '10px', color: '#666', padding: '1px 6px', background: '#f5f5f5', borderRadius: '3px' }}>{p.property_type}</span>
                      )}
                      {tx && p.transaction_type && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', background: tx.bg, color: tx.color }}>{p.transaction_type}</span>
                      )}
                      <span style={{ fontSize: '12px', color: '#1a1a1a', fontWeight: 700 }}>{priceStr}</span>
                      {p.is_sold && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', background: '#fef0ee', color: '#e04a4a', border: '1px solid #f5c2bd' }}>거래완료</span>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* 계약 이력 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>
            <span>📋 계약 이력 ({contracts.length})</span>
            <Link href={`/admin/contracts/new?landlord_id=${landlordId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: '#e2a06e', color: '#fff', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>
              <Plus size={12} /> 새 계약
            </Link>
          </h2>
          {contracts.length === 0 ? (
            <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>계약 이력이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {contracts.map(c => {
                const eff = effectiveStatus(c) as ContractStatus;
                const colors = getStatusColors(eff);
                const dInfo = getDDayInfo(c.end_date, c.contract_type as ContractType);
                const prop = c.property_id ? propertyMap[c.property_id] : null;
                return (
                  <Link key={c.id} href={`/admin/contracts/${c.id}`} style={{ display: 'block', padding: '12px 14px', border: '1px solid #e0e0e0', borderRadius: '6px', background: '#fff', textDecoration: 'none', color: '#1a1a1a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>{eff}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#f5f5f5', color: '#666' }}>{c.contract_type}</span>
                      {prop && <span style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a1a' }}>{prop.property_number}</span>}
                      <span style={{ fontSize: '12px', color: '#666', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.tenant_name ?? '-'}</span>
                      {dInfo.urgency !== 'na' && (
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: dInfo.bg, color: dInfo.color }}>{dInfo.label}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#888', flexWrap: 'wrap' }}>
                      <span>{formatPeriod(c.start_date, c.end_date)}</span>
                      <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{formatContractPrice(c)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
