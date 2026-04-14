'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

declare global {
  interface Window { daum: any; }
}

// ── 이미지 압축 ─────────────────────────────────────────────
const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
          URL.revokeObjectURL(url);
          resolve(compressed);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
};

// ── R2 업로드 ────────────────────────────────────────────────
const uploadImageToR2 = async (file: File): Promise<string> => {
  const compressed = await compressImage(file, 1000, 0.5);
  const formData = new FormData();
  formData.append('file', compressed);
  formData.append('folder', 'properties');
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.url;
};

// ── R2 이미지 삭제 ───────────────────────────────────────────
const deleteImageFromR2 = async (imageUrl: string): Promise<void> => {
  try {
    const urlObj = new URL(imageUrl);
    const path = urlObj.pathname.replace(/^\//, '');
    await fetch('/api/delete-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  } catch (err) {
    console.error('R2 삭제 실패:', err);
  }
};

const TX_TYPES   = ['월세', '전세', '매매'];
const PROP_TYPES = ['상가', '사무실', '오피스텔', '아파트', '건물', '기타'];
const THEME_TYPES = ['추천매물', '사옥형및통임대', '대형상가', '대형사무실', '무권리상가', '프랜차이즈양도양수', '1층상가', '2층이상상가'];
const DIRECTIONS = ['동', '서', '남', '북', '남동', '남서', '북동', '북서'];

const labelSt: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' };
const inputSt: React.CSSProperties = { width: '100%', height: '40px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff' };
const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' };
const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '24px', marginBottom: '20px' };
const sectionTitle: React.CSSProperties = { fontSize: '18px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e' };

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyNumber = params?.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 로그인 체크
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
    });
  }, []);

  const [propertyId, setPropertyId] = useState<string>('');
  const [form, setForm] = useState({
    property_number: '',
    transaction_type: '월세',
    property_type: '상가',
    theme_types: [] as string[],
    address: '',
    latitude: '',
    longitude: '',
    deposit: '',
    monthly_rent: '',
    maintenance_fee: '',
    premium: '',
    supply_area: '',
    exclusive_area: '',
    current_floor: '',
    total_floor: '',
    building_name: '',
    unit_number: '',
    usage_type: '',
    direction: '',
    parking: false,
    elevator: false,
    available_date: '',
    available_immediate: false,
    available_negotiable: false,
    approval_date: '',
    is_recommended: false,
    is_new: false,
    is_sold: false,
    description: '',
    admin_memo: '',
    landlord_name: '',
    landlord_phone: '',
    tenant_name: '',
    tenant_phone: '',
    extra_contacts: [] as { name: string; phone: string; role: string }[],
  });

  // 기존 이미지 (DB에 저장된)
  const [existingImages, setExistingImages] = useState<{ id: string; image_url: string }[]>([]);
  // 새로 추가할 이미지
  const [newImages, setNewImages] = useState<{ file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [kakaoReady, setKakaoReady] = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  // ── 기존 데이터 fetch
  useEffect(() => {
    if (!propertyNumber) return;
    (async () => {
      setLoadingData(true);
      const { data } = await supabase
        .from('properties')
        .select('*')
        .eq('property_number', propertyNumber)
        .single();

      if (!data) { alert('매물을 찾을 수 없습니다.'); router.back(); return; }

      setPropertyId(data.id);

      const avail = data.available_date ?? '';
      setForm({
        property_number: data.property_number ?? '',
        transaction_type: data.transaction_type ?? '월세',
        property_type: data.property_type ?? '상가',
        theme_types: data.theme_type ? data.theme_type.split(',').filter(Boolean) : [],
        address: data.address ?? '',
        latitude: data.latitude ? String(data.latitude) : '',
        longitude: data.longitude ? String(data.longitude) : '',
        deposit: data.deposit ? String(data.deposit) : '',
        monthly_rent: data.monthly_rent ? String(data.monthly_rent) : '',
        maintenance_fee: data.maintenance_fee ? String(data.maintenance_fee) : '',
        premium: data.premium ? String(data.premium) : '',
        supply_area: data.supply_area ?? '',
        exclusive_area: data.exclusive_area ?? '',
        current_floor: data.current_floor ?? '',
        total_floor: data.total_floor ?? '',
        building_name: data.building_name ?? '',
        unit_number: data.unit_number ?? '',
        usage_type: data.usage_type ?? '',
        direction: data.direction ?? '',
        parking: data.parking === true || data.parking === '가능',
        elevator: data.elevator === true || data.elevator === '있음',
        available_date: avail.includes('즉시') || avail.includes('협의') ? '' : avail,
        available_immediate: avail.includes('즉시'),
        available_negotiable: avail.includes('협의'),
        approval_date: data.approval_date ?? '',
        is_recommended: data.is_recommended ?? false,
        is_new: data.is_new ?? false,
        is_sold: data.is_sold ?? false,
        description: data.description ?? '',
        admin_memo: data.admin_memo ?? '',
        landlord_name: data.landlord_name ?? '',
        landlord_phone: data.landlord_phone ?? '',
        tenant_name: data.tenant_name ?? '',
        tenant_phone: data.tenant_phone ?? '',
        extra_contacts: Array.isArray(data.extra_contacts) ? data.extra_contacts : [],
      });

      // 기존 이미지 조회
      const { data: imgs } = await supabase
        .from('property_images')
        .select('id, image_url')
        .eq('property_id', data.id)
        .order('order_index', { ascending: true });
      setExistingImages(imgs ?? []);
      setLoadingData(false);
    })();
  }, [propertyNumber]);

  // ── SDK 로드
  useEffect(() => {
    if (!document.getElementById('daum-postcode-script')) {
      const s1 = document.createElement('script');
      s1.id = 'daum-postcode-script';
      s1.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      s1.async = true;
      document.head.appendChild(s1);
    }
    const initKakao = () => {
      if (typeof window.kakao?.maps?.services?.Geocoder === 'function') { setKakaoReady(true); return; }
      if (window.kakao?.maps?.load) { window.kakao.maps.load(() => setKakaoReady(true)); return; }
      if (!document.querySelector('script[src*="dapi.kakao.com/v2/maps/sdk"]')) {
        const s = document.createElement('script');
        s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=8a478b4b6ea5e02722a33f6ac2fa34b6&autoload=false&libraries=services';
        s.async = true;
        s.onload = () => window.kakao.maps.load(() => setKakaoReady(true));
        document.head.appendChild(s);
      } else {
        const t = setInterval(() => {
          if (typeof window.kakao?.maps?.services?.Geocoder === 'function') { clearInterval(t); setKakaoReady(true); }
          else if (window.kakao?.maps?.load) { clearInterval(t); window.kakao.maps.load(() => setKakaoReady(true)); }
        }, 200);
      }
    };
    initKakao();
  }, []);

  const searchAddress = () => {
    if (!window.daum?.Postcode) { alert('주소검색 스크립트를 불러오는 중입니다.'); return; }
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        const addr = data.userSelectedType === 'J' ? (data.jibunAddress || data.autoJibunAddress) : (data.roadAddress || data.autoRoadAddress);
        setForm(prev => ({ ...prev, address: addr }));
        if (!kakaoReady) return;
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.addressSearch(addr, (result: any, status: any) => {
          if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
            setForm(prev => ({ ...prev, address: addr, latitude: result[0].y, longitude: result[0].x }));
          }
        });
      },
    }).open();
  };

  // ── 기존 이미지 삭제
  const removeExistingImage = async (img: { id: string; image_url: string }) => {
    await deleteImageFromR2(img.image_url);
    await supabase.from('property_images').delete().eq('id', img.id);
    setExistingImages(prev => prev.filter(i => i.id !== img.id));
  };

  // ── 새 이미지 추가
  const addImageFiles = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const remaining = 20 - existingImages.length - newImages.length;
    if (remaining <= 0) { alert('최대 20장까지 업로드 가능합니다.'); return; }
    const selected = imageFiles.slice(0, remaining);
    setNewImages(prev => [...prev, ...selected.map(file => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addImageFiles(Array.from(e.target.files ?? []));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeNewImage = (idx: number) => {
    setNewImages(prev => { URL.revokeObjectURL(prev[idx].preview); return prev.filter((_, i) => i !== idx); });
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setFileDragOver(false);
    if (e.dataTransfer.files.length > 0) addImageFiles(Array.from(e.dataTransfer.files));
  };

  // ── 저장 (UPDATE)
  const handleSave = async () => {
    setSaving(true);

    try {
      const row: any = {
        transaction_type: form.transaction_type,
        property_type: form.property_type,
        usage_type: form.usage_type || null,
        theme_type: form.theme_types.length > 0 ? form.theme_types.join(',') : null,
        address: form.address,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        deposit: form.deposit ? parseInt(form.deposit) : null,
        monthly_rent: form.monthly_rent ? parseInt(form.monthly_rent) : null,
        maintenance_fee: form.maintenance_fee ? parseInt(form.maintenance_fee) : null,
        premium: form.premium ? parseInt(form.premium) : null,
        supply_area: form.supply_area || null,
        exclusive_area: form.exclusive_area || null,
        current_floor: form.current_floor || null,
        total_floor: form.total_floor || null,
        building_name: form.building_name || null,
        unit_number: form.unit_number || null,
        direction: form.direction || null,
        parking: form.parking,
        elevator: form.elevator,
        available_date: (() => {
          const parts = [form.available_immediate && '즉시입주', form.available_negotiable && '협의가능'].filter(Boolean);
          if (parts.length > 0) return parts.join('/');
          return form.available_date || null;
        })(),
        approval_date: form.approval_date || null,
        is_recommended: form.is_recommended,
        is_new: form.is_new,
        is_sold: form.is_sold,
        description: form.description || null,
        admin_memo: form.admin_memo || null,
        landlord_name: form.landlord_name || null,
        landlord_phone: form.landlord_phone || null,
        tenant_name: form.tenant_name || null,
        tenant_phone: form.tenant_phone || null,
        extra_contacts: form.extra_contacts.length > 0 ? form.extra_contacts : null,
      };

      console.log('[수정] UPDATE 데이터:', row);
      console.log('[수정] property_number:', propertyNumber);
      const { data: updateData, error: updateErr } = await supabase
        .from('properties')
        .update(row)
        .eq('property_number', propertyNumber)
        .select();
      console.log('[수정] UPDATE 결과:', { updateData, updateErr });
      if (updateErr) throw updateErr;

      // 기존 이미지 order_index 업데이트
      for (let i = 0; i < existingImages.length; i++) {
        await supabase.from('property_images').update({ order_index: i }).eq('id', existingImages[i].id);
      }

      // 새 이미지 R2 업로드
      const startIdx = existingImages.length;
      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i];
        let publicUrl: string;
        try {
          publicUrl = await uploadImageToR2(img.file);
        } catch (err) {
          console.error('R2 업로드 실패:', err);
          continue;
        }
        await supabase.from('property_images').insert({
          property_id: propertyId,
          image_url: publicUrl,
          order_index: startIdx + i,
        });
      }

      alert('매물이 수정되었습니다.');
      router.push(`/item/view/${form.property_number}`);
    } catch (err: any) {
      alert(`저장 실패: ${err.message ?? err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <main style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '16px', color: '#888' }}>매물 정보를 불러오는 중...</p>
      </main>
    );
  }

  const totalImages = existingImages.length + newImages.length;

  return (
    <main className="admin-page" style={{ background: '#f5f5f5', minHeight: '100vh', padding: '24px' }}>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1199px) {
          .admin-page { padding: 16px !important; }
        }
        @media (max-width: 767px) {
          .admin-page { padding: 12px 8px !important; }
          .admin-page h1 { font-size: 22px !important; }
          .admin-form-grid { grid-template-columns: 1fr !important; }
          .admin-section { padding: 16px 12px !important; margin-bottom: 12px !important; }
          .admin-section-title { font-size: 16px !important; margin-bottom: 12px !important; padding-bottom: 8px !important; }
          .admin-img-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .admin-btn-row { flex-direction: column !important; }
          .admin-btn-row button { width: 100% !important; }
          .admin-checkbox-row { gap: 12px !important; }
          .admin-theme-row { gap: 8px !important; }
          .admin-theme-row label { font-size: 13px !important; }
          .admin-sold-row { padding: 12px 12px !important; }
          .admin-sold-row span { font-size: 15px !important; }
          .admin-sold-row p { font-size: 11px !important; }
        }
      ` }} />
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a', marginBottom: '4px' }}>매물 수정</h1>
          <p style={{ fontSize: '14px', color: '#888' }}>매물번호: {form.property_number}</p>
        </div>

        {/* ════════════ 거래완료 ════════════ */}
        <div className="admin-sold-row" style={{ background: form.is_sold ? '#fff0f0' : '#fff', border: `2px solid ${form.is_sold ? '#e04a4a' : '#e0e0e0'}`, borderRadius: '8px', padding: '16px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: form.is_sold ? '#e04a4a' : '#333' }}>
              {form.is_sold ? '거래완료 상태입니다' : '거래 진행 중'}
            </span>
            <p style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>거래완료 시 매물 카드에 "거래완료" 표시가 됩니다.</p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={form.is_sold}
              onChange={e => set('is_sold', e.target.checked)}
              style={{ width: '22px', height: '22px', accentColor: '#e04a4a', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#e04a4a' }}>거래완료</span>
          </label>
        </div>

        {/* ════════════ 기본 정보 ════════════ */}
        <div className="admin-section" style={sectionSt}>
          <h2 className="admin-section-title" style={sectionTitle}>기본 정보</h2>
          <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelSt}>매물번호</label>
              <input value={form.property_number} readOnly style={{ ...inputSt, background: '#f5f5f5', color: '#999' }} />
            </div>
            <div>
              <label style={labelSt}>거래유형</label>
              <select value={form.transaction_type} onChange={e => set('transaction_type', e.target.value)} style={selectSt}>
                {TX_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>매물종류</label>
              <select value={form.property_type} onChange={e => set('property_type', e.target.value)} style={selectSt}>
                {PROP_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>테마종류 <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 400 }}>(다중 선택 가능)</span></label>
              <div className="admin-theme-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '8px 0' }}>
                {THEME_TYPES.map(t => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '14px', color: '#444' }}>
                    <input
                      type="checkbox"
                      checked={form.theme_types.includes(t)}
                      onChange={e => {
                        if (e.target.checked) {
                          set('theme_types', [...form.theme_types, t]);
                        } else {
                          set('theme_types', form.theme_types.filter((v: string) => v !== t));
                        }
                      }}
                      style={{ width: '16px', height: '16px', accentColor: '#e2a06e', cursor: 'pointer' }}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ════════════ 위치 정보 ════════════ */}
        <div className="admin-section" style={sectionSt}>
          <h2 className="admin-section-title" style={sectionTitle}>위치 정보</h2>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelSt}>주소</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={form.address} readOnly style={{ ...inputSt, flex: 1 }} />
              <button onClick={searchAddress} style={{ height: '40px', padding: '0 20px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>주소 검색</button>
            </div>
          </div>
          <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label style={labelSt}>위도</label><input value={form.latitude} onChange={e => set('latitude', e.target.value)} style={{ ...inputSt, background: '#f9f9f9' }} /></div>
            <div><label style={labelSt}>경도</label><input value={form.longitude} onChange={e => set('longitude', e.target.value)} style={{ ...inputSt, background: '#f9f9f9' }} /></div>
          </div>
        </div>

        {/* ════════════ 금액 정보 ════════════ */}
        <div className="admin-section" style={sectionSt}>
          <h2 className="admin-section-title" style={sectionTitle}>금액 정보 <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 400 }}>(만원 단위)</span></h2>
          <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label style={labelSt}>보증금</label><input type="number" value={form.deposit} onChange={e => set('deposit', e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>월세</label><input type="number" value={form.monthly_rent} onChange={e => set('monthly_rent', e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>관리비</label><input type="number" value={form.maintenance_fee} onChange={e => set('maintenance_fee', e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>권리금</label><input type="number" value={form.premium} onChange={e => set('premium', e.target.value)} placeholder="0 입력 시 무권리" style={inputSt} /></div>
          </div>
        </div>

        {/* ════════════ 상세 정보 ════════════ */}
        <div className="admin-section" style={sectionSt}>
          <h2 className="admin-section-title" style={sectionTitle}>상세 정보</h2>
          <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label style={labelSt}>공급면적 (㎡)</label><input value={form.supply_area} onChange={e => set('supply_area', e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>전용면적 (㎡)</label><input value={form.exclusive_area} onChange={e => set('exclusive_area', e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>현재층</label><input value={form.current_floor} onChange={e => set('current_floor', e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>전체층</label><input value={form.total_floor} onChange={e => set('total_floor', e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>건물명</label><input value={form.building_name} onChange={e => set('building_name', e.target.value)} placeholder="예: 삼성빌딩" style={inputSt} /></div>
            <div><label style={labelSt}>호수</label><input value={form.unit_number} onChange={e => set('unit_number', e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>용도</label><input value={form.usage_type} onChange={e => set('usage_type', e.target.value)} style={inputSt} /></div>
            <div>
              <label style={labelSt}>방향</label>
              <select value={form.direction} onChange={e => set('direction', e.target.value)} style={selectSt}>
                <option value="">선택</option>
                {DIRECTIONS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>입주가능일</label>
              <input type="date" value={form.available_date} onChange={e => set('available_date', e.target.value)} disabled={form.available_immediate || form.available_negotiable} style={{ ...inputSt, background: (form.available_immediate || form.available_negotiable) ? '#f5f5f5' : '#fff' }} />
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px', color: '#444' }}>
                  <input type="checkbox" checked={form.available_immediate} onChange={e => set('available_immediate', e.target.checked)} style={{ accentColor: '#e2a06e' }} /> 즉시입주
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px', color: '#444' }}>
                  <input type="checkbox" checked={form.available_negotiable} onChange={e => set('available_negotiable', e.target.checked)} style={{ accentColor: '#e2a06e' }} /> 협의가능
                </label>
              </div>
            </div>
            <div><label style={labelSt}>사용승인일</label><input value={form.approval_date} onChange={e => set('approval_date', e.target.value)} placeholder="예: 2026.03.14" style={inputSt} /></div>
          </div>
          <div className="admin-checkbox-row" style={{ display: 'flex', gap: '24px', marginTop: '20px', flexWrap: 'wrap' }}>
            {[{ key: 'parking', label: '주차 가능' }, { key: 'elevator', label: '엘리베이터' }, { key: 'is_recommended', label: '추천매물' }, { key: 'is_new', label: '신규매물' }].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', color: '#444' }}>
                <input type="checkbox" checked={(form as any)[key]} onChange={e => set(key, e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#e2a06e' }} /> {label}
              </label>
            ))}
          </div>
        </div>

        {/* ════════════ 매물 설명 ════════════ */}
        <div className="admin-section" style={sectionSt}>
          <h2 className="admin-section-title" style={sectionTitle}>매물 설명</h2>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} style={{ width: '100%', minHeight: '180px', border: '1px solid #ddd', borderRadius: '6px', padding: '12px', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.8', fontFamily: 'inherit' }} />
        </div>

        {/* ════════════ 관리자 메모 ════════════ */}
        <div className="admin-section" style={{ ...sectionSt, background: '#fffdf0', border: '1px solid #f0e6b8' }}>
          <h2 style={{ ...sectionTitle, borderBottom: '2px solid #d4a017' }}>🔒 관리자 메모</h2>
          <textarea value={form.admin_memo} onChange={e => set('admin_memo', e.target.value)} placeholder="관리자 전용 메모" style={{ width: '100%', minHeight: '120px', border: '1px solid #e0d8a8', borderRadius: '6px', padding: '12px', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.8', fontFamily: 'inherit', background: '#fffef8' }} />
        </div>

        {/* ════════════ 연락처 (관리자 전용) ════════════ */}
        <div className="admin-section" style={{ ...sectionSt, background: '#f0f6ff', border: '1px solid #c6dcf3' }}>
          <h2 style={{ ...sectionTitle, borderBottom: '2px solid #4a7cdc' }}>🔒 연락처 <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 400 }}>(관리자 전용)</span></h2>

          <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelSt}>임대인 이름</label>
              <input value={form.landlord_name} onChange={e => set('landlord_name', e.target.value)} placeholder="예: 홍길동" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>임대인 전화번호</label>
              <input value={form.landlord_phone} onChange={e => set('landlord_phone', e.target.value)} placeholder="예: 010-1234-5678" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>임차인 이름</label>
              <input value={form.tenant_name} onChange={e => set('tenant_name', e.target.value)} placeholder="예: 김철수" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>임차인 전화번호</label>
              <input value={form.tenant_phone} onChange={e => set('tenant_phone', e.target.value)} placeholder="예: 010-9876-5432" style={inputSt} />
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ ...labelSt, marginBottom: 0 }}>추가 연락처 ({form.extra_contacts.length}/5)</label>
              {form.extra_contacts.length < 5 && (
                <button
                  type="button"
                  onClick={() => set('extra_contacts', [...form.extra_contacts, { name: '', phone: '', role: '' }])}
                  style={{ padding: '6px 12px', fontSize: '13px', background: '#4a7cdc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  + 연락처 추가
                </button>
              )}
            </div>
            {form.extra_contacts.map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <input
                  value={c.name}
                  onChange={e => { const arr = [...form.extra_contacts]; arr[i] = { ...arr[i], name: e.target.value }; set('extra_contacts', arr); }}
                  placeholder="이름" style={inputSt}
                />
                <input
                  value={c.role}
                  onChange={e => { const arr = [...form.extra_contacts]; arr[i] = { ...arr[i], role: e.target.value }; set('extra_contacts', arr); }}
                  placeholder="관계" style={inputSt}
                />
                <input
                  value={c.phone}
                  onChange={e => { const arr = [...form.extra_contacts]; arr[i] = { ...arr[i], phone: e.target.value }; set('extra_contacts', arr); }}
                  placeholder="전화번호" style={inputSt}
                />
                <button
                  type="button"
                  onClick={() => set('extra_contacts', form.extra_contacts.filter((_, idx) => idx !== i))}
                  style={{ width: '36px', height: '40px', background: '#fff', color: '#e05050', border: '1px solid #e05050', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════ 이미지 ════════════ */}
        <div className="admin-section" style={sectionSt}>
          <h2 className="admin-section-title" style={sectionTitle}>이미지 ({totalImages}/20)</h2>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />

          <div
            onDragOver={e => { e.preventDefault(); setFileDragOver(true); }}
            onDragLeave={() => setFileDragOver(false)}
            onDrop={handleFileDrop}
            className="admin-img-grid"
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px',
              padding: '12px', borderRadius: '8px', minHeight: '160px',
              border: fileDragOver ? '2px dashed #e2a06e' : '2px dashed transparent',
              background: fileDragOver ? 'rgba(226,160,110,0.06)' : 'transparent',
            }}
          >
            {/* 기존 이미지 */}
            {existingImages.map((img, i) => (
              <div key={img.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e0e0e0', background: '#f0f0f0' }}>
                <img src={img.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {i === 0 && <span style={{ position: 'absolute', top: '4px', left: '4px', background: '#e2a06e', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px' }}>대표</span>}
                <span style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '10px', padding: '1px 5px', borderRadius: '3px' }}>{i + 1}</span>
                <button onClick={() => removeExistingImage(img)} style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}

            {/* 새 이미지 */}
            {newImages.map((img, i) => (
              <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: '6px', overflow: 'hidden', border: '2px solid #e2a06e', background: '#f0f0f0' }}>
                <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{ position: 'absolute', top: '4px', left: '4px', background: '#4caf50', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px' }}>NEW</span>
                <span style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '10px', padding: '1px 5px', borderRadius: '3px' }}>{existingImages.length + i + 1}</span>
                <button onClick={() => removeNewImage(i)} style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}

            {totalImages < 20 && (
              <div onClick={() => fileInputRef.current?.click()} style={{ aspectRatio: '1', borderRadius: '6px', border: '2px dashed #ddd', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#aaa', gap: '4px' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#e2a06e')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#ddd')}
              >
                <span style={{ fontSize: '28px' }}>+</span>
                <span style={{ fontSize: '12px' }}>이미지 추가</span>
              </div>
            )}
          </div>
        </div>

        {/* ════════════ 버튼 ════════════ */}
        <div className="admin-btn-row" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingBottom: '40px' }}>
          <button onClick={() => router.back()} style={{ height: '48px', padding: '0 32px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '16px', color: '#666', background: '#fff', cursor: 'pointer' }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{ height: '48px', padding: '0 40px', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 700, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#ccc' : '#e2a06e' }}>
            {saving ? '저장 중...' : '매물 수정'}
          </button>
        </div>

      </div>
    </main>
  );
}
