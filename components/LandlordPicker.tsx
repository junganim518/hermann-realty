'use client';

import { useEffect, useState } from 'react';
import { X, Plus, Search, Phone, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Landlord = {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
  business_number?: string | null;
};

interface Props {
  value: string;
  onChange: (id: string, landlord?: Landlord) => void;
  /** 하위호환: landlord_id 비어있을 때 표시할 기존 텍스트 */
  fallbackName?: string;
  fallbackPhone?: string;
}

export default function LandlordPicker({ value, onChange, fallbackName, fallbackPhone }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [landlord, setLandlord] = useState<Landlord | null>(null);
  const [allLandlords, setAllLandlords] = useState<Landlord[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', phone: '', email: '', business_number: '' });
  const [saving, setSaving] = useState(false);

  // 선택된 임대인 정보 fetch
  useEffect(() => {
    if (!value) { setLandlord(null); return; }
    // 캐시(allLandlords)에 있으면 활용
    const cached = allLandlords.find(l => l.id === value);
    if (cached) { setLandlord(cached); return; }
    (async () => {
      const { data } = await supabase.from('landlords').select('id, name, phone, email, business_number').eq('id', value).single();
      if (data) setLandlord(data);
    })();
  }, [value]);

  // 모달 열림 시 임대인 목록 + body scroll lock
  useEffect(() => {
    if (!modalOpen) return;
    (async () => {
      const { data } = await supabase.from('landlords').select('id, name, phone, email, business_number').order('name');
      setAllLandlords(data ?? []);
    })();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [modalOpen]);

  const openModal = () => {
    setModalOpen(true);
    setCreating(false);
    setSearch(fallbackName || '');
    setCreateForm({
      name: fallbackName || '',
      phone: fallbackPhone || '',
      email: '',
      business_number: '',
    });
  };

  const handleSelect = (l: Landlord) => {
    onChange(l.id, l);
    setLandlord(l);
    setModalOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    if (!confirm('임대인 연결을 해제하시겠습니까? (임대인 정보 자체는 삭제되지 않습니다)')) return;
    onChange('');
    setLandlord(null);
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) { alert('이름은 필수입니다.'); return; }
    setSaving(true);
    const payload = {
      name: createForm.name.trim(),
      phone: createForm.phone.trim() || null,
      email: createForm.email.trim() || null,
      business_number: createForm.business_number.trim() || null,
    };
    const { data: inserted, error } = await supabase.from('landlords').insert(payload).select('id, name, phone, email, business_number').single();
    setSaving(false);
    if (error || !inserted) { alert(`등록 실패: ${error?.message ?? '알 수 없는 오류'}`); return; }
    handleSelect(inserted);
  };

  const filtered = allLandlords.filter(l => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (l.name ?? '').toLowerCase().includes(q) || (l.phone ?? '').toLowerCase().includes(q);
  });

  // 표시 — 선택된 임대인 또는 fallback 텍스트 또는 빈 상태
  const renderDisplay = () => {
    if (landlord) {
      return (
        <div style={{ flex: 1, fontSize: '14px' }}>
          <strong style={{ color: '#1a1a1a' }}>{landlord.name}</strong>
          {landlord.phone && <span style={{ color: '#666', marginLeft: '8px' }}>{landlord.phone}</span>}
          <span style={{ display: 'inline-block', marginLeft: '8px', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px', background: '#dcfce7', color: '#166534' }}>연결됨</span>
        </div>
      );
    }
    if (fallbackName || fallbackPhone) {
      return (
        <div style={{ flex: 1, fontSize: '14px', color: '#666' }}>
          {fallbackName && <span>{fallbackName}</span>}
          {fallbackPhone && <span style={{ marginLeft: '8px' }}>{fallbackPhone}</span>}
          <span style={{ display: 'inline-block', marginLeft: '8px', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px', background: '#fef3c7', color: '#92400e' }}>미연결 (텍스트)</span>
        </div>
      );
    }
    return <span style={{ flex: 1, color: '#aaa', fontSize: '14px' }}>임대인 미선택 (선택사항)</span>;
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', background: '#fff', minHeight: '40px' }}>
        {renderDisplay()}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={openModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: '#1a1a1a', color: '#e2a06e', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
          >
            <Search size={12} /> {landlord ? '변경' : '선택'}
          </button>
          {landlord && (
            <button
              type="button"
              onClick={handleClear}
              style={{ padding: '6px 10px', background: '#fff', color: '#888', border: '1px solid #ddd', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
            >해제</button>
          )}
        </div>
      </div>

      {/* 검색/등록 모달 */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px', overflow: 'auto' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: 'auto' }}
          >
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{creating ? '새 임대인 등록' : '임대인 선택'}</h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#666' }}>
                <X size={20} />
              </button>
            </div>

            {!creating ? (
              <>
                {/* 검색 + 새 등록 버튼 */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="이름 또는 전화번호 검색"
                    autoFocus
                    style={{ width: '100%', height: '36px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '36px', background: '#fff', color: '#e2a06e', border: '1px solid #e2a06e', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Plus size={14} /> 새 임대인 등록
                  </button>
                </div>

                {/* 검색 결과 */}
                <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px', minHeight: 0 }}>
                  {filtered.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '40px 0', color: '#aaa', fontSize: '13px' }}>
                      {allLandlords.length === 0 ? '등록된 임대인이 없습니다' : '일치하는 임대인이 없습니다'}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {filtered.map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => handleSelect(l)}
                          style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '10px 12px', textAlign: 'left', background: '#fff', border: '1px solid #eee', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={12} color="#666" />
                            <strong style={{ fontSize: '13px' }}>{l.name}</strong>
                          </div>
                          {l.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '18px' }}>
                              <Phone size={11} color="#888" />
                              <span style={{ fontSize: '12px', color: '#666' }}>{l.phone}</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* 새 임대인 인라인 등록 */
              <>
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', minHeight: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '4px' }}>이름 *</label>
                      <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="홍길동" style={{ width: '100%', height: '36px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '4px' }}>전화번호</label>
                      <input value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" style={{ width: '100%', height: '36px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '4px' }}>이메일</label>
                      <input value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="example@email.com" style={{ width: '100%', height: '36px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '4px' }}>사업자번호</label>
                      <input value={createForm.business_number} onChange={e => setCreateForm(f => ({ ...f, business_number: e.target.value }))} placeholder="000-00-00000" style={{ width: '100%', height: '36px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
                    </div>
                    <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>주소·메모 등 추가 정보는 <a href="/admin/landlords" target="_blank" rel="noreferrer" style={{ color: '#e2a06e' }}>임대인 관리</a>에서 수정 가능합니다.</p>
                  </div>
                </div>
                <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', gap: '8px', flexShrink: 0 }}>
                  <button type="button" onClick={() => setCreating(false)} style={{ padding: '8px 14px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>← 검색으로</button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={saving || !createForm.name.trim()}
                    style={{ padding: '8px 18px', background: saving || !createForm.name.trim() ? '#ccc' : '#e2a06e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: saving || !createForm.name.trim() ? 'not-allowed' : 'pointer' }}
                  >{saving ? '등록 중...' : '등록 + 선택'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
