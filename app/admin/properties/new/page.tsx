'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

declare global {
  interface Window { daum: any; }
}

// ── 상수 ─────────────────────────────────────────────────────
const TX_TYPES   = ['월세', '전세', '매매'];
const PROP_TYPES = ['상가', '사무실', '원룸·투룸', '쓰리룸이상', '아파트', '건물매매'];
const THEME_TYPES = ['추천매물', '사옥형및통임대', '대형상가', '대형사무실', '무권리상가', '프랜차이즈양도양수', '1층상가', '2층이상상가'];
const DIRECTIONS = ['동', '서', '남', '북', '남동', '남서', '북동', '북서'];

// ── 스타일 ────────────────────────────────────────────────────
const labelSt: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' };
const inputSt: React.CSSProperties = { width: '100%', height: '40px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff' };
const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' };
const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '24px', marginBottom: '20px' };
const sectionTitle: React.CSSProperties = { fontSize: '18px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e' };

export default function NewPropertyPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 폼 상태
  const [form, setForm] = useState({
    property_number: '',
    title: '',
    transaction_type: '월세',
    property_type: '상가',
    theme_type: '',
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
    description: '',
  });

  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // ── 매물번호 자동생성 (10000부터 시작, 최대값 +1)
  useEffect(() => {
    async function fetchNextNumber() {
      const { data } = await supabase
        .from('properties')
        .select('property_number')
        .order('property_number', { ascending: false })
        .limit(100);

      let maxNum = 9999;
      (data ?? []).forEach((row: any) => {
        const n = parseInt(row.property_number, 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      });
      set('property_number', String(maxNum + 1));
    }
    fetchNextNumber();
  }, []);

  // ── 카카오 주소검색 스크립트 로드
  useEffect(() => {
    if (document.getElementById('daum-postcode-script')) return;
    const script = document.createElement('script');
    script.id = 'daum-postcode-script';
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // ── 폼 업데이트 헬퍼
  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  // ── 카카오 주소검색 + 좌표 변환
  const searchAddress = () => {
    if (!window.daum?.Postcode) {
      alert('주소검색 스크립트를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new window.daum.Postcode({
      oncomplete: async (data: any) => {
        const addr = data.roadAddress || data.jibunAddress;
        set('address', addr);

        // 카카오 REST API로 좌표 변환
        try {
          const res = await fetch(
            `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(addr)}`,
            { headers: { Authorization: `KakaoAK 8a478b4b6ea5e02722a33f6ac2fa34b6` } }
          );
          const json = await res.json();
          if (json.documents?.length > 0) {
            const { y, x } = json.documents[0];
            setForm(prev => ({ ...prev, address: addr, latitude: y, longitude: x }));
          }
        } catch {
          // 좌표 변환 실패 시 주소만 저장
        }
      },
    }).open();
  };

  // ── 이미지 추가 공통 로직
  const addImageFiles = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const remaining = 20 - images.length;
    if (remaining <= 0) { alert('최대 20장까지 업로드 가능합니다.'); return; }

    const selected = imageFiles.slice(0, remaining);
    const newImages = selected.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  // ── 파일 input 선택
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addImageFiles(Array.from(e.target.files ?? []));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── 외부 파일 드래그앤드롭
  const [fileDragOver, setFileDragOver] = useState(false);
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFileDragOver(false);
    // 외부 파일 드롭 (이미지 재정렬 드래그와 구분)
    if (e.dataTransfer.files.length > 0) {
      addImageFiles(Array.from(e.dataTransfer.files));
    }
  };

  // ── 이미지 삭제
  const removeImage = (idx: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // ── 이미지 드래그 정렬
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    setImages(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(targetIdx, 0, moved);
      return arr;
    });
    setDragIdx(null);
  };

  // ── 저장
  const handleSave = async () => {
    if (!form.title.trim()) { alert('제목을 입력해주세요.'); return; }
    if (!form.address.trim()) { alert('주소를 입력해주세요.'); return; }

    setSaving(true);

    try {
      const propertyNumber = form.property_number.trim();
      if (!propertyNumber) { alert('매물번호가 비어있습니다.'); setSaving(false); return; }

      // 1) properties 테이블 INSERT
      const row: any = {
        property_number: propertyNumber,
        title: form.title,
        transaction_type: form.transaction_type,
        property_type: form.property_type,
        usage_type: form.usage_type || null,
        theme_type: form.theme_type || null,
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
        unit_number: form.unit_number || null,
        direction: form.direction || null,
        parking: form.parking,
        elevator: form.elevator,
        available_date: (() => {
          const parts = [
            form.available_immediate && '즉시입주',
            form.available_negotiable && '협의가능',
          ].filter(Boolean);
          if (parts.length > 0) return parts.join('/');
          return form.available_date || null;
        })(),
        approval_date: form.approval_date || null,
        is_recommended: form.is_recommended,
        is_new: form.is_new,
        description: form.description || null,
      };

      console.log('[1] properties INSERT 시작:', propertyNumber);
      const { data: inserted, error: insertErr } = await supabase
        .from('properties')
        .insert(row)
        .select('id, property_number')
        .single();
      console.log('[1] INSERT 결과:', { inserted, insertErr });
      if (insertErr) throw insertErr;

      const propertyId = inserted.id;
      const pNum = inserted.property_number;
      console.log('[1] 성공 — uuid:', propertyId, 'property_number:', pNum);

      // 2) 이미지 업로드 + property_images INSERT
      console.log(`[2] 이미지 업로드 시작 (${images.length}장)`);
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const ext = img.file.name.split('.').pop() ?? 'jpg';
        const fileName = `${i}_${Date.now()}.${ext}`;
        const storagePath = `${pNum}/${fileName}`;

        // Storage 업로드
        console.log(`[2-${i + 1}] Storage 업로드 경로:`, storagePath);
        const { data: upData, error: upErr } = await supabase.storage
          .from('property-images')
          .upload(storagePath, img.file, { cacheControl: '3600', upsert: false });
        console.log(`[2-${i + 1}] Storage 결과:`, { upData, upErr });
        if (upErr) { console.error(`[2-${i + 1}] Storage 업로드 실패:`, upErr); continue; }

        // Public URL
        const { data: urlData } = supabase.storage
          .from('property-images')
          .getPublicUrl(storagePath);
        const publicUrl = urlData.publicUrl;
        console.log(`[3-${i + 1}] Public URL:`, publicUrl);

        // property_images INSERT
        const insertPayload = {
          property_id: propertyId,
          image_url: publicUrl,
          order_index: i,
        };
        console.log(`[4-${i + 1}] property_images INSERT 데이터:`, insertPayload);
        const { data: imgData, error: imgErr } = await supabase
          .from('property_images')
          .insert(insertPayload)
          .select();
        console.log(`[4-${i + 1}] property_images 결과:`, { imgData, imgErr });
        if (imgErr) {
          console.error(`[4-${i + 1}] property_images INSERT 실패:`, imgErr);
        }
      }

      alert('매물이 등록되었습니다.');
      router.push(`/item/view/${propertyNumber}`);
    } catch (err: any) {
      console.error(err);
      alert(`저장 실패: ${err.message ?? err}`);
    } finally {
      setSaving(false);
    }
  };

  // ── 렌더
  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* 페이지 헤더 */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a', marginBottom: '4px' }}>매물 등록</h1>
          <p style={{ fontSize: '14px', color: '#888' }}>새 매물 정보를 입력하고 저장하세요.</p>
        </div>

        {/* ════════════ 기본 정보 ════════════ */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>기본 정보</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelSt}>매물번호 <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 400 }}>(자동생성 — 수정 가능)</span></label>
              <input value={form.property_number} onChange={e => set('property_number', e.target.value)} placeholder="자동 생성 중..." style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>제목 *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="매물 제목을 입력하세요" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>거래유형 *</label>
              <select value={form.transaction_type} onChange={e => set('transaction_type', e.target.value)} style={selectSt}>
                {TX_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>매물종류 *</label>
              <select value={form.property_type} onChange={e => set('property_type', e.target.value)} style={selectSt}>
                {PROP_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>테마종류</label>
              <select value={form.theme_type} onChange={e => set('theme_type', e.target.value)} style={selectSt}>
                <option value="">선택 안함</option>
                {THEME_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ════════════ 위치 정보 ════════════ */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>위치 정보</h2>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelSt}>주소 *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="주소를 검색하세요" style={{ ...inputSt, flex: 1 }} readOnly />
              <button onClick={searchAddress} style={{ height: '40px', padding: '0 20px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                주소 검색
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelSt}>위도</label>
              <input value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="자동 입력" style={{ ...inputSt, background: '#f9f9f9' }} />
            </div>
            <div>
              <label style={labelSt}>경도</label>
              <input value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="자동 입력" style={{ ...inputSt, background: '#f9f9f9' }} />
            </div>
          </div>
        </div>

        {/* ════════════ 금액 정보 ════════════ */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>금액 정보 <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 400 }}>(만원 단위)</span></h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelSt}>보증금</label>
              <input type="number" value={form.deposit} onChange={e => set('deposit', e.target.value)} placeholder="예: 5000" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>월세</label>
              <input type="number" value={form.monthly_rent} onChange={e => set('monthly_rent', e.target.value)} placeholder="예: 150" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>관리비</label>
              <input type="number" value={form.maintenance_fee} onChange={e => set('maintenance_fee', e.target.value)} placeholder="예: 10" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>권리금</label>
              <input type="number" value={form.premium} onChange={e => set('premium', e.target.value)} placeholder="없으면 비워두세요" style={inputSt} />
            </div>
          </div>
        </div>

        {/* ════════════ 상세 정보 ════════════ */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>상세 정보</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelSt}>공급면적 (㎡)</label>
              <input value={form.supply_area} onChange={e => set('supply_area', e.target.value)} placeholder="예: 85.5" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>전용면적 (㎡)</label>
              <input value={form.exclusive_area} onChange={e => set('exclusive_area', e.target.value)} placeholder="예: 59.9" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>현재층</label>
              <input value={form.current_floor} onChange={e => set('current_floor', e.target.value)} placeholder="예: 3" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>전체층</label>
              <input value={form.total_floor} onChange={e => set('total_floor', e.target.value)} placeholder="예: 15" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>호수</label>
              <input value={form.unit_number} onChange={e => set('unit_number', e.target.value)} placeholder="예: 712" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>용도</label>
              <input value={form.usage_type} onChange={e => set('usage_type', e.target.value)} placeholder="예: 근린생활시설, 업무시설" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>방향</label>
              <select value={form.direction} onChange={e => set('direction', e.target.value)} style={selectSt}>
                <option value="">선택</option>
                {DIRECTIONS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>입주가능일</label>
              <input
                type="date"
                value={form.available_date}
                onChange={e => set('available_date', e.target.value)}
                disabled={form.available_immediate || form.available_negotiable}
                style={{ ...inputSt, background: (form.available_immediate || form.available_negotiable) ? '#f5f5f5' : '#fff' }}
              />
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px', color: '#444' }}>
                  <input type="checkbox" checked={form.available_immediate} onChange={e => set('available_immediate', e.target.checked)} style={{ accentColor: '#e2a06e' }} />
                  즉시입주
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px', color: '#444' }}>
                  <input type="checkbox" checked={form.available_negotiable} onChange={e => set('available_negotiable', e.target.checked)} style={{ accentColor: '#e2a06e' }} />
                  협의가능
                </label>
              </div>
            </div>
            <div>
              <label style={labelSt}>사용승인일</label>
              <input value={form.approval_date} onChange={e => set('approval_date', e.target.value)} placeholder="예: 2026.03.14" style={inputSt} />
            </div>
          </div>

          {/* 체크박스 그룹 */}
          <div style={{ display: 'flex', gap: '24px', marginTop: '20px', flexWrap: 'wrap' }}>
            {[
              { key: 'parking', label: '주차 가능' },
              { key: 'elevator', label: '엘리베이터' },
              { key: 'is_recommended', label: '추천매물' },
              { key: 'is_new', label: '신규매물' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', color: '#444' }}>
                <input
                  type="checkbox"
                  checked={(form as any)[key]}
                  onChange={e => set(key, e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#e2a06e', cursor: 'pointer' }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* ════════════ 매물 설명 ════════════ */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>매물 설명</h2>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="매물 설명을 입력하세요. 줄바꿈이 그대로 적용됩니다."
            style={{ width: '100%', minHeight: '180px', border: '1px solid #ddd', borderRadius: '6px', padding: '12px', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.8', fontFamily: 'inherit' }}
          />
        </div>

        {/* ════════════ 이미지 업로드 ════════════ */}
        <div style={sectionSt}>
          <h2 style={sectionTitle}>이미지 업로드 <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 400 }}>({images.length}/20 — 드래그로 순서 변경)</span></h2>

          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />

          {/* 드롭존 + 이미지 그리드 */}
          <div
            onDragOver={e => { e.preventDefault(); setFileDragOver(true); }}
            onDragLeave={() => setFileDragOver(false)}
            onDrop={handleFileDrop}
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px',
              padding: '12px', borderRadius: '8px', minHeight: '160px',
              border: fileDragOver ? '2px dashed #e2a06e' : '2px dashed transparent',
              background: fileDragOver ? 'rgba(226,160,110,0.06)' : 'transparent',
              transition: 'all 0.2s',
            }}
          >
            {images.map((img, i) => (
              <div
                key={i}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(i)}
                style={{
                  position: 'relative', aspectRatio: '1', borderRadius: '6px', overflow: 'hidden',
                  border: dragIdx === i ? '2px solid #e2a06e' : '1px solid #e0e0e0',
                  cursor: 'grab', background: '#f0f0f0',
                }}
              >
                <img src={img.preview} alt={`이미지 ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {i === 0 && (
                  <span style={{ position: 'absolute', top: '4px', left: '4px', background: '#e2a06e', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px' }}>
                    대표
                  </span>
                )}
                <span style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '10px', padding: '1px 5px', borderRadius: '3px' }}>
                  {i + 1}
                </span>
                <button
                  onClick={() => removeImage(i)}
                  style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            ))}

            {/* 추가 버튼 */}
            {images.length < 20 && (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  aspectRatio: '1', borderRadius: '6px', border: '2px dashed #ddd',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#aaa', gap: '4px', transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#e2a06e')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#ddd')}
              >
                <span style={{ fontSize: '28px', lineHeight: 1 }}>+</span>
                <span style={{ fontSize: '12px' }}>이미지 추가</span>
              </div>
            )}
          </div>
        </div>

        {/* ════════════ 저장 버튼 ════════════ */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingBottom: '40px' }}>
          <button
            onClick={() => router.back()}
            style={{ height: '48px', padding: '0 32px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '16px', color: '#666', background: '#fff', cursor: 'pointer' }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              height: '48px', padding: '0 40px', border: 'none', borderRadius: '6px',
              fontSize: '16px', fontWeight: 700, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? '#ccc' : '#e2a06e', transition: 'background 0.2s',
            }}
          >
            {saving ? '저장 중...' : '매물 등록'}
          </button>
        </div>

      </div>
    </main>
  );
}
