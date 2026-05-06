'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CONTRACT_TYPES, CONTRACT_STATUSES, type ContractType, type ContractStatus } from '@/lib/contracts';

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
  const initialPropertyId = searchParams.get('property_id') ?? '';
  const initialLandlordId = searchParams.get('landlord_id') ?? '';

  const [authChecked, setAuthChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [allLandlords, setAllLandlords] = useState<any[]>([]);

  const [form, setForm] = useState({
    property_id: initialPropertyId,
    landlord_id: initialLandlordId,
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

  // 매물/임대인 검색 모달 (선택용)
  const [propModalOpen, setPropModalOpen] = useState(false);
  const [landlordModalOpen, setLandlordModalOpen] = useState(false);
  const [propSearch, setPropSearch] = useState('');
  const [landlordSearch, setLandlordSearch] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/contracts/new'); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      const [{ data: props }, { data: lands }] = await Promise.all([
        supabase.from('properties').select('id, property_number, address, building_name, transaction_type').order('property_number', { ascending: false }),
        supabase.from('landlords').select('id, name, phone').order('name'),
      ]);
      setAllProperties(props ?? []);
      setAllLandlords(lands ?? []);

      // 매물 prefill 시 거래유형 자동 설정
      if (initialPropertyId) {
        const p = (props ?? []).find(x => x.id === initialPropertyId);
        if (p && (p.transaction_type === '월세' || p.transaction_type === '전세' || p.transaction_type === '매매')) {
          setForm(prev => ({ ...prev, contract_type: p.transaction_type }));
        }
      }
    })();
  }, [authChecked]);

  // body 스크롤 잠금 (모달 열림)
  useEffect(() => {
    if (propModalOpen || landlordModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [propModalOpen, landlordModalOpen]);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const selectedProperty = allProperties.find(p => p.id === form.property_id);
  const selectedLandlord = allLandlords.find(l => l.id === form.landlord_id);

  const handleSave = async () => {
    setSaving(true);
    const toInt = (s: string) => {
      const n = parseInt(s.replace(/,/g, ''), 10);
      return isNaN(n) ? null : n;
    };
    const payload = {
      property_id: form.property_id || null,
      landlord_id: form.landlord_id || null,
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

  // 매물 검색 결과
  const filteredProps = allProperties.filter(p => {
    const q = propSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(p.property_number ?? '').includes(q) ||
      (p.address ?? '').toLowerCase().includes(q) ||
      (p.building_name ?? '').toLowerCase().includes(q)
    );
  }).slice(0, 50);

  const filteredLandlords = allLandlords.filter(l => {
    const q = landlordSearch.trim().toLowerCase();
    if (!q) return true;
    return (l.name ?? '').toLowerCase().includes(q) || (l.phone ?? '').toLowerCase().includes(q);
  }).slice(0, 50);

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
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>매물</label>
              <button
                type="button"
                onClick={() => setPropModalOpen(true)}
                style={{ ...inputSt, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {selectedProperty ? (
                  <span style={{ flex: 1, fontSize: '14px', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <strong>{selectedProperty.property_number}</strong> · {selectedProperty.address}
                    {selectedProperty.building_name && ` · ${selectedProperty.building_name}`}
                  </span>
                ) : (
                  <span style={{ flex: 1, color: '#aaa' }}>매물 선택 (선택사항)</span>
                )}
                {selectedProperty && (
                  <span onClick={e => { e.stopPropagation(); set('property_id', ''); }} style={{ color: '#888', fontSize: '13px', padding: '0 4px' }}>×</span>
                )}
              </button>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>임대인</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setLandlordModalOpen(true)}
                  style={{ ...inputSt, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', flex: 1 }}
                >
                  {selectedLandlord ? (
                    <span style={{ flex: 1, fontSize: '14px', color: '#1a1a1a' }}>
                      <strong>{selectedLandlord.name}</strong>{selectedLandlord.phone && ` · ${selectedLandlord.phone}`}
                    </span>
                  ) : (
                    <span style={{ flex: 1, color: '#aaa' }}>임대인 선택 (선택사항)</span>
                  )}
                  {selectedLandlord && (
                    <span onClick={e => { e.stopPropagation(); set('landlord_id', ''); }} style={{ color: '#888', fontSize: '13px', padding: '0 4px' }}>×</span>
                  )}
                </button>
                <a href="/admin/landlords/new" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '40px', padding: '0 12px', background: '#fff', color: '#e2a06e', border: '1px solid #e2a06e', borderRadius: '6px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>+ 새 임대인</a>
              </div>
            </div>
            <div>
              <label style={labelSt}>임차인 이름</label>
              <input value={form.tenant_name} onChange={e => set('tenant_name', e.target.value)} placeholder="홍길동" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>임차인 연락처</label>
              <input value={form.tenant_phone} onChange={e => set('tenant_phone', e.target.value)} placeholder="010-0000-0000" style={inputSt} />
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

      {/* 매물 선택 모달 */}
      {propModalOpen && (
        <SearchModal
          title="매물 선택"
          query={propSearch}
          onQueryChange={setPropSearch}
          onClose={() => setPropModalOpen(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredProps.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px 0', color: '#aaa', fontSize: '13px' }}>일치하는 매물이 없습니다</p>
            ) : filteredProps.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { set('property_id', p.id); if (p.transaction_type === '월세' || p.transaction_type === '전세' || p.transaction_type === '매매') set('contract_type', p.transaction_type); setPropModalOpen(false); }}
                style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 10px', textAlign: 'left', background: '#fff', border: '1px solid #eee', borderRadius: '6px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px' }}>{p.property_number}</strong>
                  {p.transaction_type && <span style={{ fontSize: '10px', color: '#e2a06e', fontWeight: 700 }}>{p.transaction_type}</span>}
                </div>
                <span style={{ fontSize: '11px', color: '#666' }}>{p.address}{p.building_name && ` · ${p.building_name}`}</span>
              </button>
            ))}
          </div>
        </SearchModal>
      )}

      {/* 임대인 선택 모달 */}
      {landlordModalOpen && (
        <SearchModal
          title="임대인 선택"
          query={landlordSearch}
          onQueryChange={setLandlordSearch}
          onClose={() => setLandlordModalOpen(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredLandlords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px' }}>일치하는 임대인이 없습니다</p>
                <a href="/admin/landlords/new" target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '8px 14px', background: '#e2a06e', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>+ 새 임대인 등록</a>
              </div>
            ) : filteredLandlords.map(l => (
              <button
                key={l.id}
                type="button"
                onClick={() => { set('landlord_id', l.id); setLandlordModalOpen(false); }}
                style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 10px', textAlign: 'left', background: '#fff', border: '1px solid #eee', borderRadius: '6px', cursor: 'pointer' }}
              >
                <strong style={{ fontSize: '13px' }}>{l.name}</strong>
                {l.phone && <span style={{ fontSize: '11px', color: '#666' }}>{l.phone}</span>}
              </button>
            ))}
          </div>
        </SearchModal>
      )}
    </main>
  );
}

/* ════════════ 검색 모달 ════════════ */
function SearchModal({ title, query, onQueryChange, onClose, children }: {
  title: string;
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px', overflow: 'auto' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: 'auto' }}
      >
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#666' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          <input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="검색"
            autoFocus
            style={{ width: '100%', height: '36px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
