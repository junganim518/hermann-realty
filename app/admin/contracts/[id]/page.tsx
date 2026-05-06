'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Trash2, ArrowLeft, RefreshCw, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  effectiveStatus,
  getStatusColors,
  getDDayInfo,
  formatContractPrice,
  formatDateShort,
  type ContractType,
  type ContractStatus,
} from '@/lib/contracts';
import { formatMaintenance } from '@/lib/formatProperty';

export default function ContractDetailPage() {
  const router = useRouter();
  const params = useParams();
  const contractId = params?.id as string;

  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [landlord, setLandlord] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(`/login?redirect=/admin/contracts/${contractId}`); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      const { data: c } = await supabase.from('contracts').select('*').eq('id', contractId).single();
      if (!c) { alert('계약을 찾을 수 없습니다.'); router.push('/admin/contracts'); return; }
      setContract(c);
      const promises = [];
      if (c.property_id) promises.push(supabase.from('properties').select('id, property_number, address, building_name, unit_number').eq('id', c.property_id).single().then(r => setProperty(r.data)));
      if (c.landlord_id) promises.push(supabase.from('landlords').select('*').eq('id', c.landlord_id).single().then(r => setLandlord(r.data)));
      await Promise.all(promises);
      setLoading(false);
    })();
  }, [authChecked]);

  const handleDelete = async () => {
    if (!confirm('이 계약을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('contracts').delete().eq('id', contractId);
    if (error) { alert(`삭제 실패: ${error.message}`); return; }
    alert('삭제되었습니다.');
    router.push('/admin/contracts');
  };

  if (!authChecked || loading || !contract) return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</main>;

  const eff = effectiveStatus(contract) as ContractStatus;
  const colors = getStatusColors(eff);
  const dInfo = getDDayInfo(contract.end_date, contract.contract_type as ContractType);
  const isMaeMae = contract.contract_type === '매매';

  const labelTextSt: React.CSSProperties = { fontSize: '12px', color: '#888', fontWeight: 500, marginBottom: '2px' };
  const valueTextSt: React.CSSProperties = { fontSize: '14px', color: '#1a1a1a', fontWeight: 500 };
  const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', marginBottom: '16px' };
  const sectionTitleSt: React.CSSProperties = { fontSize: '17px', fontWeight: 700, color: '#1a1a1a', marginBottom: '14px', paddingBottom: '8px', borderBottom: '2px solid #e2a06e' };

  // 재계약: 새 계약 등록 페이지로 (property_id, landlord_id 자동 입력)
  const renewQuery = new URLSearchParams();
  if (contract.property_id) renewQuery.set('property_id', contract.property_id);
  if (contract.landlord_id) renewQuery.set('landlord_id', contract.landlord_id);

  const fmtMan = (v: number | null | undefined): string => {
    if (!v) return '-';
    return `${v.toLocaleString()}만원`;
  };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px 16px 60px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => { if (window.history.length > 1) router.back(); else router.push('/admin/contracts'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
              <ArrowLeft size={14} /> 계약 목록
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>계약 상세</h1>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '999px', background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>{eff}</span>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '999px', background: '#f5f5f5', color: '#666' }}>{contract.contract_type}</span>
            {dInfo.urgency !== 'na' && (
              <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '999px', background: dInfo.bg, color: dInfo.color }}>{dInfo.label}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <Link href={`/admin/contracts/new?${renewQuery.toString()}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 14px', background: '#fff', color: '#16a34a', border: '1px solid #16a34a', borderRadius: '6px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              <RefreshCw size={14} /> 재계약
            </Link>
            <Link href={`/admin/contracts/${contractId}/edit`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 14px', background: '#1a1a1a', color: '#e2a06e', borderRadius: '6px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              <Pencil size={14} /> 수정
            </Link>
            <button onClick={handleDelete} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 14px', background: '#fff', color: '#e05050', border: '1px solid #e05050', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              <Trash2 size={14} /> 삭제
            </button>
          </div>
        </div>

        {/* 매물 정보 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>🏢 매물 정보</h2>
          {property ? (
            <a href={`/item/view/${property.property_number}`} target="_blank" rel="noreferrer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f9f9f9', borderRadius: '6px', textDecoration: 'none', color: '#1a1a1a' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '2px' }}>{property.property_number}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {property.address}
                  {property.building_name && ` · ${property.building_name}`}
                  {property.unit_number && ` ${property.unit_number}`}
                </div>
              </div>
              <span style={{ fontSize: '12px', color: '#e2a06e', fontWeight: 700 }}>매물 보기 →</span>
            </a>
          ) : (
            <p style={{ color: '#888', fontSize: '13px' }}>(매물 미연결)</p>
          )}
        </div>

        {/* 임대인 정보 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>👤 임대인</h2>
          {landlord ? (
            <Link href={`/admin/landlords/${landlord.id}`} style={{ display: 'block', padding: '12px 14px', background: '#f9f9f9', borderRadius: '6px', textDecoration: 'none', color: '#1a1a1a' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                <div><div style={labelTextSt}>이름</div><div style={valueTextSt}>{landlord.name}</div></div>
                <div><div style={labelTextSt}>연락처</div><div style={valueTextSt}>{landlord.phone || '-'}</div></div>
                {landlord.business_number && (<div><div style={labelTextSt}>사업자번호</div><div style={valueTextSt}>{landlord.business_number}</div></div>)}
              </div>
            </Link>
          ) : (
            <p style={{ color: '#888', fontSize: '13px' }}>(임대인 미연결)</p>
          )}
        </div>

        {/* 임차인 정보 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>🧑 임차인</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
            <div><div style={labelTextSt}>이름</div><div style={valueTextSt}>{contract.tenant_name || '-'}</div></div>
            <div>
              <div style={labelTextSt}>연락처</div>
              {contract.tenant_phone ? (
                <a href={`tel:${contract.tenant_phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: '#e2a06e', fontWeight: 600, textDecoration: 'none' }}>
                  <Phone size={12} /> {contract.tenant_phone}
                </a>
              ) : <div style={valueTextSt}>-</div>}
            </div>
            <div><div style={labelTextSt}>사업자명/상호</div><div style={valueTextSt}>{contract.tenant_business_name || '-'}</div></div>
          </div>
        </div>

        {/* 계약 일정 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>🗓 계약 일정</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
            <div><div style={labelTextSt}>계약일</div><div style={valueTextSt}>{formatDateShort(contract.contract_date)}</div></div>
            <div><div style={labelTextSt}>잔금/입주일</div><div style={valueTextSt}>{formatDateShort(contract.move_in_date)}</div></div>
            {!isMaeMae && (
              <>
                <div><div style={labelTextSt}>시작일</div><div style={valueTextSt}>{formatDateShort(contract.start_date)}</div></div>
                <div>
                  <div style={labelTextSt}>만기일</div>
                  <div style={{ ...valueTextSt, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {formatDateShort(contract.end_date)}
                    {dInfo.urgency !== 'na' && (
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: dInfo.bg, color: dInfo.color }}>{dInfo.label}</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 금액 정보 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>💰 금액 정보</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={labelTextSt}>{contract.contract_type}</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#e2a06e' }}>{formatContractPrice(contract)}</div>
            </div>
            <div><div style={labelTextSt}>관리비</div><div style={valueTextSt}>{formatMaintenance(contract.maintenance_fee)}</div></div>
            <div><div style={labelTextSt}>권리금</div><div style={valueTextSt}>{contract.premium ? fmtMan(contract.premium) : '무'}</div></div>
            <div><div style={labelTextSt}>중개수수료</div><div style={valueTextSt}>{fmtMan(contract.brokerage_fee)}</div></div>
          </div>
        </div>

        {/* 메모 */}
        {contract.memo && (
          <div style={sectionSt}>
            <h2 style={sectionTitleSt}>📝 메모</h2>
            <p style={{ fontSize: '13px', color: '#333', whiteSpace: 'pre-line', margin: 0, lineHeight: 1.7 }}>{contract.memo}</p>
          </div>
        )}
      </div>
    </main>
  );
}
