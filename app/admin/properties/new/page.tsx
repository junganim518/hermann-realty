'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const compressed = await compressImage(file);
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

// ── 상수 ─────────────────────────────────────────────────────
const TX_TYPES   = ['월세', '전세', '매매'];
const PROP_TYPES = ['상가', '사무실', '오피스텔', '아파트', '건물', '기타'];
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

  // ── 로그인 체크
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
    });
  }, []);

  // ── 폼 상태
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
    description: '',
    admin_memo: '',
    landlord_name: '',
    landlord_phone: '',
    tenant_name: '',
    tenant_phone: '',
    extra_contacts: [] as { name: string; phone: string; role: string }[],
  });

  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // ── 건축물대장 관련 상태
  const [buildingLoading, setBuildingLoading] = useState(false);
  const [buildingExposList, setBuildingExposList] = useState<any[]>([]);
  const [areaLoading, setAreaLoading] = useState(false);
  const [lastBuildingParams, setLastBuildingParams] = useState({
    sigunguCd: '', bjdongCd: '', bun: '', ji: '0000',
  });
  const [selectedBldHo, setSelectedBldHo] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

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

  // ── 다음 우편번호 + 카카오맵 SDK 로드
  const [kakaoReady, setKakaoReady] = useState(false);

  useEffect(() => {
    // 다음 우편번호
    if (!document.getElementById('daum-postcode-script')) {
      const s1 = document.createElement('script');
      s1.id = 'daum-postcode-script';
      s1.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      s1.async = true;
      document.head.appendChild(s1);
    }

    // 카카오맵 SDK
    const initKakao = () => {
      if (typeof window.kakao?.maps?.services?.Geocoder === 'function') {
        setKakaoReady(true);
        return;
      }
      if (window.kakao?.maps?.load) {
        window.kakao.maps.load(() => setKakaoReady(true));
        return;
      }
      // 스크립트 동적 삽입
      if (!document.querySelector('script[src*="dapi.kakao.com/v2/maps/sdk"]')) {
        const s2 = document.createElement('script');
        s2.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=8a478b4b6ea5e02722a33f6ac2fa34b6&autoload=false&libraries=services';
        s2.async = true;
        s2.onload = () => {
          window.kakao.maps.load(() => setKakaoReady(true));
        };
        document.head.appendChild(s2);
      } else {
        // 스크립트 태그는 있지만 아직 로드 안 됨
        const t = setInterval(() => {
          if (typeof window.kakao?.maps?.services?.Geocoder === 'function') {
            clearInterval(t); setKakaoReady(true);
          } else if (window.kakao?.maps?.load) {
            clearInterval(t);
            window.kakao.maps.load(() => setKakaoReady(true));
          }
        }, 200);
      }
    };
    initKakao();
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
      oncomplete: (data: any) => {
        // 사용자가 선택한 주소 유형에 따라 저장
        const addr = data.userSelectedType === 'J'
          ? (data.jibunAddress || data.autoJibunAddress)
          : (data.roadAddress || data.autoRoadAddress);
        setForm(prev => ({ ...prev, address: addr }));
        console.log('[주소] 선택 유형:', data.userSelectedType, '주소:', addr);

        if (!kakaoReady) {
          console.warn('[주소] 카카오 SDK 미로드 — 좌표 변환 불가');
          return;
        }

        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.addressSearch(addr, (result: any, status: any) => {
          console.log('[주소] Geocoder 결과:', status, result?.[0]);
          if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
            const lat = result[0].y;
            const lng = result[0].x;
            setForm(prev => ({ ...prev, address: addr, latitude: lat, longitude: lng }));
            console.log('[주소] 좌표 저장 — 위도:', lat, '경도:', lng);

            // 건축물대장 조회
            const addrInfo = result[0].address;
            if (addrInfo?.b_code && addrInfo?.main_address_no) {
              const sigunguCd = addrInfo.b_code.slice(0, 5);
              const bjdongCd = addrInfo.b_code.slice(5, 10);
              const bun = String(addrInfo.main_address_no).padStart(4, '0');
              const ji = String(addrInfo.sub_address_no || '0').padStart(4, '0');
              fetchBuildingInfo(sigunguCd, bjdongCd, bun, ji);
            } else {
              console.warn('[건축물대장] 주소 코드 추출 실패:', addrInfo);
            }
          } else {
            console.warn('[주소] Geocoder 실패:', status);
          }
        });
      },
    }).open();
  };

  // ── 건축물대장 조회 (표제부 + 전유부 전체)
  const fetchBuildingInfo = async (sigunguCd: string, bjdongCd: string, bun: string, ji: string) => {
    setBuildingLoading(true);
    setBuildingExposList([]);
    setSelectedBldHo('');
    setLastBuildingParams({ sigunguCd, bjdongCd, bun, ji });
    try {
      const res = await fetch(`/api/building?sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&bun=${bun}&ji=${ji}`);
      const data = await res.json();
      console.log('[건축물대장] 응답:', data);

      if (data.error) {
        console.warn('[건축물대장] 오류:', data.error);
        showToast('건축물대장 조회 실패');
        return;
      }

      applyBuildingTitle(data.title, data.buildingName);
      setBuildingExposList(data.exposList || []);

      if (data.title || (data.exposList && data.exposList.length > 0)) {
        showToast('건축물대장 정보가 자동입력되었습니다');
      } else {
        showToast('건축물대장 정보를 찾을 수 없습니다');
      }
    } catch (err: any) {
      console.error('[건축물대장] 호출 실패:', err);
      showToast('건축물대장 조회 실패');
    } finally {
      setBuildingLoading(false);
    }
  };

  // ── 표제부 정보 → 폼 반영
  const applyBuildingTitle = (title: any, buildingName?: string) => {
    if (!title && !buildingName) return;
    setForm(prev => ({
      ...prev,
      building_name: title?.bldNm || buildingName || prev.building_name,
      usage_type: title?.etcPurps || prev.usage_type,
      total_floor: title?.grndFlrCnt ? String(title.grndFlrCnt) : prev.total_floor,
      approval_date: formatYmd(title?.useAprDay) || prev.approval_date,
      elevator: Number(title?.rideUseElvtCnt) > 0 ? true : prev.elevator,
    }));
  };

  // ── 전유부 정보 → 폼 반영 (area 필드가 없어 면적은 수동 입력)
  const applyBuildingExpos = (expos: any) => {
    if (!expos) return;
    setForm(prev => ({
      ...prev,
      unit_number: expos.hoNm || prev.unit_number,
      current_floor: expos.flrNo ? String(expos.flrNo) : prev.current_floor,
    }));
  };

  // YYYYMMDD → YYYY-MM-DD
  const formatYmd = (ymd: any): string => {
    if (!ymd) return '';
    const s = String(ymd);
    if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return s;
  };

  // ── 호수 선택 시 전유공용면적 조회
  const fetchAreaInfo = async (hoNm: string) => {
    if (!lastBuildingParams.sigunguCd) return;
    const params = new URLSearchParams({
      sigunguCd: lastBuildingParams.sigunguCd,
      bjdongCd: lastBuildingParams.bjdongCd,
      bun: lastBuildingParams.bun,
      ji: lastBuildingParams.ji,
      ho: hoNm,
    });
    setAreaLoading(true);
    try {
      const res = await fetch(`/api/building?${params}`);
      const data = await res.json();
      console.log('[면적 응답]', data.areaItems);
      if (data.areaItems && data.areaItems.length > 0) {
        const 전유 = data.areaItems.find((item: any) => item.exposPubuseGbCdNm === '전유');
        const 공용들 = data.areaItems.filter((item: any) => item.exposPubuseGbCdNm === '공용');
        const 공용합계 = 공용들.reduce((sum: number, item: any) => sum + (Number(item.area) || 0), 0);

        const 전용면적 = Number(전유?.area) || 0;
        const 공급면적 = 전용면적 + 공용합계;

        console.log('[면적 계산] 전용:', 전용면적, '공용합계:', 공용합계, '공급:', 공급면적);

        setForm(prev => ({
          ...prev,
          exclusive_area: 전용면적 ? String(전용면적) : prev.exclusive_area,
          supply_area: 공급면적 ? String(Math.round(공급면적 * 100) / 100) : prev.supply_area,
          usage_type: 전유?.etcPurps || 전유?.mainPurpsCdNm || prev.usage_type,
          current_floor: 전유?.flrNo ? (전유.flrGbCdNm === '지하' ? `지하${Math.abs(전유.flrNo)}` : String(전유.flrNo)) : prev.current_floor,
        }));
      }
    } catch (err) {
      console.error('[면적 조회] 실패:', err);
    } finally {
      setAreaLoading(false);
    }
  };

  // ── 건축물대장 호 선택 (display 값으로 매칭)
  const handleBldHoChange = (display: string) => {
    setSelectedBldHo(display);
    const match = buildingExposList.find(e => e.display === display);
    if (match) {
      applyBuildingExpos(match);
      if (match.hoNm) fetchAreaInfo(match.hoNm);
    }
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
    if (!form.address.trim()) { alert('주소를 입력해주세요.'); return; }

    setSaving(true);

    try {
      const propertyNumber = form.property_number.trim();
      if (!propertyNumber) { alert('매물번호가 비어있습니다.'); setSaving(false); return; }

      // 1) properties 테이블 INSERT
      const row: any = {
        property_number: propertyNumber,
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
        admin_memo: form.admin_memo || null,
        landlord_name: form.landlord_name || null,
        landlord_phone: form.landlord_phone || null,
        tenant_name: form.tenant_name || null,
        tenant_phone: form.tenant_phone || null,
        extra_contacts: form.extra_contacts.length > 0 ? form.extra_contacts : null,
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

      // 2) 이미지 R2 업로드 + property_images INSERT
      console.log(`[2] 이미지 업로드 시작 (${images.length}장)`);
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        let publicUrl: string;
        try {
          publicUrl = await uploadImageToR2(img.file);
          console.log(`[2-${i + 1}] R2 업로드 성공:`, publicUrl);
        } catch (err) {
          console.error(`[2-${i + 1}] R2 업로드 실패:`, err);
          continue;
        }

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
    <main className="admin-page" style={{ background: '#f5f5f5', minHeight: '100vh', padding: '24px' }}>

      {toastMsg && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#333', color: '#fff', padding: '12px 24px', borderRadius: '8px',
          fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          zIndex: 9999,
        }}>
          {toastMsg}
        </div>
      )}

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
          .admin-btn-row button, .admin-btn-row a { width: 100% !important; text-align: center !important; }
          .admin-checkbox-row { gap: 12px !important; }
          .admin-theme-row { gap: 8px !important; }
          .admin-theme-row label { font-size: 13px !important; }
        }
      ` }} />

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* 페이지 헤더 */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a', marginBottom: '4px' }}>매물 등록</h1>
          <p style={{ fontSize: '14px', color: '#888' }}>새 매물 정보를 입력하고 저장하세요.</p>
        </div>

        {/* ════════════ 기본 정보 ════════════ */}
        <div className="admin-section" style={sectionSt}>
          <h2 className="admin-section-title" style={sectionTitle}>기본 정보</h2>
          <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelSt}>매물번호 <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 400 }}>(자동생성 — 수정 가능)</span></label>
              <input value={form.property_number} onChange={e => set('property_number', e.target.value)} placeholder="자동 생성 중..." style={inputSt} />
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
            <label style={labelSt}>주소 *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="주소를 검색하세요" style={{ ...inputSt, flex: 1 }} readOnly />
              <button onClick={searchAddress} style={{ height: '40px', padding: '0 20px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                주소 검색
              </button>
            </div>
          </div>

          {/* 건축물대장 건물명/호 입력 (항상 표시, API 응답 있으면 호수 드롭다운) */}
          <div style={{ marginBottom: '12px', padding: '12px', background: '#fff6ef', border: '1px solid #f0d4b8', borderRadius: '6px' }}>
            <div style={{ fontSize: '12px', color: '#8a5a2a', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🏢 건물명/호 정보
              {buildingLoading && <span style={{ color: '#e2a06e', fontWeight: 500 }}>· 건축물대장 조회 중...</span>}
              {!buildingLoading && buildingExposList.length > 0 && (
                <span style={{ color: '#888', fontWeight: 500 }}>· {buildingExposList.length}개 호실 조회됨</span>
              )}
            </div>
            <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ ...labelSt, fontSize: '12px' }}>건물명</label>
                <input value={form.building_name} onChange={e => set('building_name', e.target.value)} placeholder="예: 삼성빌딩" style={inputSt} disabled={buildingLoading} />
              </div>
              <div>
                <label style={{ ...labelSt, fontSize: '12px' }}>호수</label>
                {buildingExposList.length > 0 ? (
                  <select value={selectedBldHo} onChange={e => handleBldHoChange(e.target.value)} style={selectSt}>
                    <option value="">선택</option>
                    {buildingExposList.map((e, idx) => (
                      <option key={`${e.display}-${idx}`} value={e.display}>{e.display || '(호 없음)'}</option>
                    ))}
                  </select>
                ) : (
                  <input value={form.unit_number} onChange={e => set('unit_number', e.target.value)} placeholder="예: 101동 712호" style={inputSt} disabled={buildingLoading} />
                )}
                {areaLoading && (
                  <p style={{ fontSize: '13px', color: '#e2a06e', marginTop: '6px' }}>
                    면적 정보 불러오는 중...
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
        <div className="admin-section" style={sectionSt}>
          <h2 className="admin-section-title" style={sectionTitle}>금액 정보 <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 400 }}>(만원 단위)</span></h2>
          <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              <input type="number" value={form.premium} onChange={e => set('premium', e.target.value)} placeholder="0 입력 시 무권리" style={inputSt} />
            </div>
          </div>
        </div>

        {/* ════════════ 상세 정보 ════════════ */}
        <div className="admin-section" style={sectionSt}>
          <h2 className="admin-section-title" style={sectionTitle}>상세 정보</h2>
          <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
          <div className="admin-checkbox-row" style={{ display: 'flex', gap: '24px', marginTop: '20px', flexWrap: 'wrap' }}>
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
        <div className="admin-section" style={sectionSt}>
          <h2 className="admin-section-title" style={sectionTitle}>매물 설명</h2>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="매물 설명을 입력하세요. 줄바꿈이 그대로 적용됩니다."
            style={{ width: '100%', minHeight: '180px', border: '1px solid #ddd', borderRadius: '6px', padding: '12px', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.8', fontFamily: 'inherit' }}
          />
        </div>

        {/* ════════════ 관리자 메모 ════════════ */}
        <div className="admin-section" style={{ ...sectionSt, background: '#fffdf0', border: '1px solid #f0e6b8' }}>
          <h2 style={{ ...sectionTitle, borderBottom: '2px solid #d4a017' }}>🔒 관리자 메모 <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 400 }}>(상세페이지에서 관리자만 볼 수 있음)</span></h2>
          <textarea
            value={form.admin_memo}
            onChange={e => set('admin_memo', e.target.value)}
            placeholder="관리자 전용 메모를 입력하세요. (예: 건물주 연락처, 특이사항, 내부 참고사항 등)"
            style={{ width: '100%', minHeight: '120px', border: '1px solid #e0d8a8', borderRadius: '6px', padding: '12px', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.8', fontFamily: 'inherit', background: '#fffef8' }}
          />
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

          {/* 추가 연락처 */}
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
                  onChange={e => {
                    const arr = [...form.extra_contacts];
                    arr[i] = { ...arr[i], name: e.target.value };
                    set('extra_contacts', arr);
                  }}
                  placeholder="이름"
                  style={inputSt}
                />
                <input
                  value={c.role}
                  onChange={e => {
                    const arr = [...form.extra_contacts];
                    arr[i] = { ...arr[i], role: e.target.value };
                    set('extra_contacts', arr);
                  }}
                  placeholder="관계 (예: 세입자)"
                  style={inputSt}
                />
                <input
                  value={c.phone}
                  onChange={e => {
                    const arr = [...form.extra_contacts];
                    arr[i] = { ...arr[i], phone: e.target.value };
                    set('extra_contacts', arr);
                  }}
                  placeholder="전화번호"
                  style={inputSt}
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

        {/* ════════════ 이미지 업로드 ════════════ */}
        <div className="admin-section" style={sectionSt}>
          <h2 className="admin-section-title" style={sectionTitle}>이미지 업로드 <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 400 }}>({images.length}/20 — 드래그로 순서 변경)</span></h2>

          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />

          {/* 드롭존 + 이미지 그리드 */}
          <div
            onDragOver={e => { e.preventDefault(); setFileDragOver(true); }}
            onDragLeave={() => setFileDragOver(false)}
            onDrop={handleFileDrop}
            className="admin-img-grid"
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
        <div className="admin-btn-row" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingBottom: '40px' }}>
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
