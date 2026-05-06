'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Trash2, Plus, ArrowLeft } from 'lucide-react';
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
      const [{ data: l }, { data: cs }, { data: directProps }] = await Promise.all([
        supabase.from('landlords').select('*').eq('id', landlordId).single(),
        supabase.from('contracts').select('*').eq('landlord_id', landlordId).order('created_at', { ascending: false }),
        // properties.landlord_id로도 직접 연결된 매물 조회 (계약 없이도 등록된 매물)
        supabase.from('properties').select('id, property_number, address, building_name').eq('landlord_id', landlordId).order('property_number', { ascending: false }),
      ]);
      if (!l) { alert('임대인을 찾을 수 없습니다.'); router.push('/admin/landlords'); return; }
      setLandlord(l);
      setContracts(cs ?? []);

      // 계약에서 참조된 매물 + 직접 연결된 매물 합치기 (중복 제거)
      const map: Record<string, any> = {};
      const contractPropIds = Array.from(new Set((cs ?? []).map(c => c.property_id).filter(Boolean)));
      if (contractPropIds.length > 0) {
        const { data: contractProps } = await supabase.from('properties').select('id, property_number, address, building_name').in('id', contractPropIds);
        (contractProps ?? []).forEach(p => { map[p.id] = p; });
      }
      (directProps ?? []).forEach(p => { if (!map[p.id]) map[p.id] = p; });
      setPropertyMap(map);
      setDirectPropIds(new Set((directProps ?? []).map(p => p.id)));
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/admin/landlords')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
              <ArrowLeft size={14} /> 임대인 목록
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{landlord.name}</h1>
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

        {/* 기본 정보 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}><span>👤 기본 정보</span></h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
            <div><div style={labelTextSt}>연락처</div><div style={valueTextSt}>{landlord.phone || '-'}</div></div>
            <div><div style={labelTextSt}>이메일</div><div style={valueTextSt}>{landlord.email || '-'}</div></div>
            <div><div style={labelTextSt}>사업자번호</div><div style={valueTextSt}>{landlord.business_number || '-'}</div></div>
            <div style={{ gridColumn: '1 / -1' }}><div style={labelTextSt}>주소</div><div style={valueTextSt}>{landlord.address || '-'}</div></div>
          </div>
          {landlord.memo && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' }}>
              <div style={labelTextSt}>메모</div>
              <p style={{ fontSize: '13px', color: '#333', whiteSpace: 'pre-line', margin: '4px 0 0', lineHeight: 1.6 }}>{landlord.memo}</p>
            </div>
          )}
        </div>

        {/* 보유 매물 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>
            <span>🏢 보유 매물 ({propertiesHeld.length})</span>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>진행중 계약 기준</span>
          </h2>
          {propertiesHeld.length === 0 ? (
            <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>진행중인 계약 매물이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {propertiesHeld.map(p => (
                <a key={p.id} href={`/item/view/${p.property_number}`} target="_blank" rel="noreferrer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f9f9f9', borderRadius: '6px', textDecoration: 'none', color: '#1a1a1a' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>{p.property_number}</span>
                  <span style={{ fontSize: '12px', color: '#666', flex: 1, marginLeft: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.address}{p.building_name ? ` · ${p.building_name}` : ''}
                  </span>
                  <span style={{ fontSize: '11px', color: '#e2a06e', fontWeight: 600 }}>매물 보기 →</span>
                </a>
              ))}
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
