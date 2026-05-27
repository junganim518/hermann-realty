'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPhone } from '@/lib/phoneFormat';
import { CONTRACT_TYPES, CONTRACT_STATUSES, type ContractType, type ContractStatus } from '@/lib/contracts';

declare global {
  interface Window { daum: any; }
}

export default function NewContractPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</main>}>
      <NewContractInner />
    </Suspense>
  );
}

function NewContractInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLandlordId = searchParams.get('landlord_id') ?? '';

  const [authChecked, setAuthChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  // 재계약 시 landlord_id로 임대인 이름/전화 prefill
  const [initLandlordDone, setInitLandlordDone] = useState(false);

  const [form, setForm] = useState({
    property_address: '',
    property_building_name: '',
    property_unit_number: '',
    landlord_name: '',
    landlord_phone: '',
    contract_type: '월세' as ContractType,
    tenant_name: '',
    tenant_phone: '',
    tenant_business_name: '',
    contract_date: '',
    move_in_date: '',
    start_date: '',
    end_date: '',
    deposit: '',
    monthly_rent: '',
    maintenance_fee: '',
    premium: '',
    sale_price: '',
    brokerage_fee: '',
    status: '진행중' as ContractStatus,
    memo: '',
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/contracts/new'); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!document.getElementById('daum-postcode-script')) {
      const s = document.createElement('script');
      s.id = 'daum-postcode-script';
      s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      s.async = true;
      document.head.appendChild(s);
    }
  }, []);

  // 재계약: landlord_id로 임대인 정보 prefill
  useEffect(() => {
    if (!authChecked || initLandlordDone || !initialLandlordId) { setInitLandlordDone(true); return; }
    supabase.from('landlords').select('name, phone').eq('id', initialLandlordId).single().then(({ data }) => {
      if (data) setForm(prev => ({ ...prev, landlord_name: data.name ?? '', landlord_phone: data.phone ?? '' }));
      setInitLandlordDone(true);
    });
  }, [authChecked]);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const searchAddress = () => {
    if (!window.daum?.Postcode) {
      alert('주소검색 스크립트를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        const addr = data.userSelectedType === 'J'
          ? (data.jibunAddress || data.autoJibunAddress)
          : (data.roadAddress || data.autoRoadAddress);
        setForm(prev => ({
          ...prev,
          property_address: addr,
          property_building_name: data.buildingName || prev.property_building_name,
        }));
      },
    }).open();
  };

  const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

  const resolveLandlord = async (): Promise<{ landlord_id: string | null; landlord_name: string | null; landlord_phone: string | null }> => {
    const nameStr = form.landlord_name.trim();
    const phoneStr = form.landlord_phone.trim();
    const address = form.property_address.trim();
    const unitNumber = form.property_unit_number.trim();
    const buildingName = form.property_building_name.trim();

    if (!nameStr && !phoneStr) return { landlord_id: null, landlord_name: null, landlord_phone: null };

    // 1순위: 주소+동호수 매칭
    if (address && unitNumber) {
      const { data: matchedProps } = await supabase.from('properties')
        .select('landlord_id').eq('address', address).eq('unit_number', unitNumber)
        .not('landlord_id', 'is', null).limit(1);

      if (matchedProps && matchedProps.length > 0) {
        const matchedId = matchedProps[0].landlord_id as string;
        const { data: landlord } = await supabase.from('landlords').select('id, name, phone').eq('id', matchedId).single();
        const unitLabel = [buildingName, unitNumber].filter(Boolean).join(' ');
        const addrLine = [address, unitLabel].filter(Boolean).join(' ');
        const infoLine = [addrLine || null, landlord?.phone || null].filter(Boolean).join(' / ');
        const ok = confirm(`${infoLine}\n같은 임대인이 있습니다.\n보유 매물에 추가할까요?`);
        if (ok) return { landlord_id: landlord ? landlord.id : matchedId, landlord_name: nameStr || null, landlord_phone: phoneStr || null };
      }
    }

    // 2순위: 전화번호 매칭
    if (phoneStr) {
      const normalized = normalizePhone(phoneStr);
      if (normalized.length >= 9) {
        const { data: allLandlords } = await supabase.from('landlords').select('id, name, phone').not('phone', 'is', null);
        const matched = (allLandlords ?? []).find(l => normalizePhone(l.phone ?? '') === normalized);
        if (matched) {
          const ok = confirm(`${matched.phone}\n같은 임대인이 있습니다.\n보유 매물에 추가할까요?`);
          if (ok) return { landlord_id: matched.id, landlord_name: nameStr || null, landlord_phone: phoneStr || null };
        }
      }
    }

    // 신규 등록
    if (phoneStr) {
      const { data: newLandlord } = await supabase.from('landlords')
        .insert({ name: nameStr || null, phone: phoneStr }).select('id').single();
      return { landlord_id: newLandlord?.id ?? null, landlord_name: nameStr || null, landlord_phone: phoneStr || null };
    }

    // 전화번호 없음 → landlords 미등록, 텍스트만 저장
    return { landlord_id: null, landlord_name: nameStr || null, landlord_phone: null };
  };

  const handleSave = async () => {
    setSaving(true);
    const toInt = (s: string) => { const n = parseInt(s.replace(/,/g, ''), 10); return isNaN(n) ? null : n; };
    const { landlord_id, landlord_name, landlord_phone } = await resolveLandlord();
    const payload = {
      property_address: form.property_address.trim() || null,
      property_building_name: form.property_building_name.trim() || null,
      property_unit_number: form.property_unit_number.trim() || null,
      landlord_id,
      landlord_name,
      landlord_phone,
      contract_type: form.contract_type,
      tenant_name: form.tenant_name.trim() || null,
      tenant_phone: form.tenant_phone.trim() || null,
      tenant_business_name: form.tenant_business_name.trim() || null,
      contract_date: form.contract_date || null,
      move_in_date: form.move_in_date || null,
      start_date: form.start_date || null,
      end_date: form.contract_type === '매매' ? null : (form.end_date || null),
      deposit: toInt(form.deposit),
      monthly_rent: form.contract_type === '월세' ? toInt(form.monthly_rent) : null,
      maintenance_fee: toInt(form.maintenance_fee),
      premium: toInt(form.premium),
      sale_price: form.contract_type === '매매' ? toInt(form.sale_price) : null,
      brokerage_fee: toInt(form.brokerage_fee),
      status: form.status,
      memo: form.memo.trim() || null,
    };
    const { data: inserted, error } = await supabase.from('contracts').insert(payload).select('id').single();
    setSaving(false);
    if (error || !inserted) { alert(`등록 실패: ${error?.message ?? '알 수 없는 오류'}`); return; }
    alert('등록되었습니다.');
    router.push(`/admin/contracts/${inserted.id}`);
  };

  if (!authChecked) return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>인증 중...</main>;

  const labelSt: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' };
  const inputSt: React.CSSProperties = { width: '100%', height: '40px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff' };
  const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' };
  const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', marginBottom: '16px' };
  const sectionTitle: React.CSSProperties = { fontSize: '16px', fontWeight: 700, color: '#1a1a1a', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid #e2a06e' };

  const isMaeMae = form.contract_type === '매매';
  const isWolse = form.contract_type === '월세';

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <button onClick={() => router.push('/admin/contracts')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '12px' }}>
          <ArrowLeft size={14} /> 계약 목록
        </button>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', marginBottom: '20px' }}>새 계약 등록</h1>

        {/* 기본 정보 */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>📋 기본 정보</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>계약 종류 *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {CONTRACT_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => set('contract_type', t)} style={{
                    flex: 1, padding: '10px', border: form.contract_type === t ? '2px solid #1a1a1a' : '1px solid #ddd',
                    borderRadius: '6px', background: form.contract_type === t ? '#1a1a1a' : '#fff',
                    color: form.contract_type === t ? '#e2a06e' : '#666',
                    fontSize: '14px', fontWeight: form.contract_type === t ? 700 : 500, cursor: 'pointer',
                  }}>{t}</button>
                ))}
              </div>
            </div>
            {/* 매물 주소 */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>매물 주소</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={form.property_address} readOnly placeholder="주소를 검색하세요" style={{ ...inputSt, flex: 1 }} />
                <button type="button" onClick={searchAddress} style={{ height: '40px', padding: '0 16px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>주소 검색</button>
              </div>
            </div>
            <div>
              <label style={labelSt}>건물명</label>
              <input value={form.property_building_name} onChange={e => set('property_building_name', e.target.value)} placeholder="예: 현대타워" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>동호수</label>
              <input value={form.property_unit_number} onChange={e => set('property_unit_number', e.target.value)} placeholder="예: 3층 301호" style={inputSt} />
            </div>
            {/* 임대인 */}
            <div>
              <label style={labelSt}>임대인 이름</label>
              <input value={form.landlord_name} onChange={e => set('landlord_name', e.target.value)} placeholder="예: 김철수" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>임대인 전화번호</label>
              <input value={form.landlord_phone} onChange={e => set('landlord_phone', formatPhone(e.target.value))} placeholder="010-1234-5678" style={inputSt} maxLength={13} />
            </div>
            {/* 임차인 */}
            <div>
              <label style={labelSt}>임차인 이름</label>
              <input value={form.tenant_name} onChange={e => set('tenant_name', e.target.value)} placeholder="홍길동" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>임차인 연락처</label>
              <input value={form.tenant_phone} onChange={e => set('tenant_phone', formatPhone(e.target.value))} placeholder="010-0000-0000" style={inputSt} maxLength={13} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>임차인 사업자명/상호명</label>
              <input value={form.tenant_business_name} onChange={e => set('tenant_business_name', e.target.value)} placeholder="예: GS25, 스타벅스 부천중동점" style={inputSt} />
            </div>
          </div>
        </div>

        {/* 계약 일정 */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>🗓 계약 일정</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelSt}>계약일</label>
              <input type="date" value={form.contract_date} onChange={e => set('contract_date', e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>잔금/입주일</label>
              <input type="date" value={form.move_in_date} onChange={e => set('move_in_date', e.target.value)} style={inputSt} />
            </div>
            <div style={{ opacity: isMaeMae ? 0.4 : 1 }}>
              <label style={labelSt}>계약 시작일 {isMaeMae && <span style={{ color: '#aaa', fontWeight: 400 }}>(매매는 미적용)</span>}</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} disabled={isMaeMae} style={inputSt} />
            </div>
            <div style={{ opacity: isMaeMae ? 0.4 : 1 }}>
              <label style={labelSt}>계약 만기일 {isMaeMae && <span style={{ color: '#aaa', fontWeight: 400 }}>(매매는 미적용)</span>}</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} disabled={isMaeMae} style={inputSt} />
            </div>
          </div>
        </div>

        {/* 금액 정보 */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>💰 금액 정보 <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 400 }}>(만원 단위)</span></h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {!isMaeMae && (
              <>
                <div>
                  <label style={labelSt}>보증금</label>
                  <input type="number" value={form.deposit} onChange={e => set('deposit', e.target.value)} placeholder="예: 3000" style={inputSt} />
                </div>
                <div style={{ opacity: isWolse ? 1 : 0.4 }}>
                  <label style={labelSt}>월세 {!isWolse && <span style={{ color: '#aaa', fontWeight: 400 }}>(월세 계약만)</span>}</label>
                  <input type="number" value={form.monthly_rent} onChange={e => set('monthly_rent', e.target.value)} placeholder="예: 100" disabled={!isWolse} style={inputSt} />
                </div>
              </>
            )}
            {isMaeMae && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>매매가</label>
                <input type="number" value={form.sale_price} onChange={e => set('sale_price', e.target.value)} placeholder="예: 35000" style={inputSt} />
              </div>
            )}
            <div>
              <label style={labelSt}>관리비</label>
              <input type="number" value={form.maintenance_fee} onChange={e => set('maintenance_fee', e.target.value)} placeholder="비워두면 별도" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>권리금</label>
              <input type="number" value={form.premium} onChange={e => set('premium', e.target.value)} placeholder="없으면 비움" style={inputSt} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>중개수수료</label>
              <input type="number" value={form.brokerage_fee} onChange={e => set('brokerage_fee', e.target.value)} placeholder="만원" style={inputSt} />
            </div>
          </div>
        </div>

        {/* 상태 + 메모 */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>📝 상태 / 메모</h2>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelSt}>상태</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={selectSt}>
              {CONTRACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>메모</label>
            <textarea value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="특이사항, 협의 내용" rows={4}
              style={{ width: '100%', border: '1px solid #ddd', borderRadius: '6px', padding: '10px 12px', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', height: '48px', background: saving ? '#ccc' : '#e2a06e', color: '#fff', fontSize: '15px', fontWeight: 700, border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '저장 중...' : '계약 등록'}
        </button>
      </div>
    </main>
  );
}
