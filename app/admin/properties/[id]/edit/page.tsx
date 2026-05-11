'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { generateTitle } from '@/lib/generateTitle';

declare global {
  interface Window { daum: any; }
}

function SortableEditImageItem({ id, src, index, badge, borderColor, onRemove }: {
  id: string; src: string; index: number; badge?: { label: string; bg: string }; borderColor?: string; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const, aspectRatio: '1', borderRadius: '6px', overflow: 'hidden' as const,
    border: `${borderColor === '#e2a06e' ? '2px' : '1px'} solid ${borderColor || '#e0e0e0'}`, background: '#f0f0f0', cursor: 'grab',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
      {index === 0 && !badge && (
        <span style={{ position: 'absolute', top: '4px', left: '4px', background: '#e2a06e', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px' }}>대표</span>
      )}
      {badge && (
        <span style={{ position: 'absolute', top: '4px', left: '4px', background: badge.bg, color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px' }}>{badge.label}</span>
      )}
      <span style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '10px', padding: '1px 5px', borderRadius: '3px' }}>{index + 1}</span>
      <button type="button" onPointerDown={e => e.stopPropagation()} onClick={onRemove}
        style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
      >×</button>
    </div>
  );
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
const THEME_TYPES = [
  '추천매물', '사옥형및통임대', '대형상가', '대형사무실', '무권리상가', '프랜차이즈양도양수', '1층상가', '2층이상상가',
  '역세권매물', '신축매물', '저렴한매물', '코너매물', '메인상권', '즉시입주', '대로변매물', '노출좋음', '인기매물',
  '카페', '사무실', '음식점', '병원', '학원', '뷰티', '편의점', '헬스장',
];
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
  const origLandlordRef = useRef<{ id: string; name: string; phone: string }>({ id: '', name: '', phone: '' });
  const [form, setForm] = useState({
    property_number: '',
    title: '',
    transaction_type: '월세',
    property_type: '상가',
    theme_types: [] as string[],
    address: '',
    land_number: '',
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
    business_name: '',
    business_name_public: false,
    unit_number: '',
    usage_type: '',
    direction: '',
    parking: false,
    elevator: false,
    total_parking: '',
    room_count: '',
    bathroom_count: '',
    available_date: '',
    available_immediate: false,
    available_negotiable: false,
    approval_date: '',
    is_sold: false,
    status: '거래중' as '거래중' | '보류' | '거래완료',
    description: '',
    admin_memo: '',
    landlord_id: '',
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

  // 건축물대장 관련 상태
  const [buildingLoading, setBuildingLoading] = useState(false);
  const [buildingExposList, setBuildingExposList] = useState<any[]>([]);
  const [areaLoading, setAreaLoading] = useState(false);
  const [lastBuildingParams, setLastBuildingParams] = useState({
    sigunguCd: '', bjdongCd: '', bun: '', ji: '0000',
  });
  const [selectedBldHos, setSelectedBldHos] = useState<string[]>([]);
  const [areaCache, setAreaCache] = useState<Record<string, { exclusive: number; publicArea: number; currentFloor?: string; usageType?: string }>>({});
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

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
      origLandlordRef.current = {
        id: data.landlord_id ?? '',
        name: data.landlord_name ?? '',
        phone: data.landlord_phone ?? '',
      };

      const avail = data.available_date ?? '';
      const availParts = avail.split('/').map((s: string) => s.trim()).filter(Boolean);
      const availDateOnly = availParts.find((p: string) => p !== '즉시입주' && p !== '협의가능') || '';
      setForm({
        property_number: data.property_number ?? '',
        title: data.title ?? '',
        transaction_type: data.transaction_type ?? '월세',
        property_type: data.property_type ?? '상가',
        theme_types: data.theme_type ? data.theme_type.split(',').filter(Boolean) : [],
        address: data.address ?? '',
        land_number: data.land_number ?? '',
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
        business_name: data.business_name ?? '',
        business_name_public: !!data.business_name_public,
        unit_number: data.unit_number ?? '',
        usage_type: data.usage_type ?? '',
        direction: data.direction ?? '',
        parking: data.parking === true || data.parking === '가능',
        elevator: data.elevator === true || data.elevator === '있음',
        total_parking: data.total_parking != null ? String(data.total_parking) : '',
        room_count: data.room_count != null ? String(data.room_count) : '',
        bathroom_count: data.bathroom_count != null ? String(data.bathroom_count) : '',
        available_date: availDateOnly,
        available_immediate: availParts.includes('즉시입주'),
        available_negotiable: availParts.includes('협의가능'),
        approval_date: data.approval_date ?? '',
        is_sold: data.is_sold ?? false,
        status: (data.status === '보류' || data.status === '거래완료' || data.status === '거래중')
          ? data.status
          : (data.is_sold ? '거래완료' : '거래중'),
        description: data.description ?? '',
        admin_memo: data.admin_memo ?? '',
        landlord_id: data.landlord_id ?? '',
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
      if (!document.querySelector('script[src*="dapi.kakao.com/v2/maps/sdk"][src*="libraries=services"]')) {
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
    console.log('[주소검색] window.daum:', !!window.daum, 'Postcode:', !!window.daum?.Postcode);
    console.log('[주소검색] window.kakao:', !!window.kakao, 'maps.services:', !!window.kakao?.maps?.services, 'Geocoder:', !!window.kakao?.maps?.services?.Geocoder);
    if (!window.daum?.Postcode) { alert('주소검색 스크립트를 불러오는 중입니다.'); return; }
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        const addr = data.userSelectedType === 'J' ? (data.jibunAddress || data.autoJibunAddress) : (data.roadAddress || data.autoRoadAddress);
        const jibun = data.jibunAddress || data.autoJibunAddress || '';
        setForm(prev => ({ ...prev, address: addr, land_number: jibun }));
        if (!kakaoReady) return;
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.addressSearch(addr, (result: any, status: any) => {
          if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
            const lat = result[0].y;
            const lng = result[0].x;
            setForm(prev => ({ ...prev, address: addr, land_number: jibun, latitude: lat, longitude: lng }));

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
          }
        });
      },
    }).open();
  };

  // ── 건축물대장 조회 (표제부 + 전유부 전체)
  const fetchBuildingInfo = async (sigunguCd: string, bjdongCd: string, bun: string, ji: string) => {
    setBuildingLoading(true);
    setBuildingExposList([]);
    setSelectedBldHos([]);
    setAreaCache({});
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

      // 케이스 분기:
      // 1) 집합건축물(전유부 있음) → 호실 선택
      // 2) 일반건축물 다층(층별개요 2개+) → 층 선택
      // 3) 단층/단일 → 선택 영역 숨김 (자동입력만)
      const expos: any[] = data.exposList || [];
      const flrs: any[] = data.flrList || [];
      const listToUse: any[] = expos.length > 0 ? expos : (flrs.length > 1 ? flrs : []);
      console.log('[건축물대장] 케이스:', expos.length > 0 ? 1 : flrs.length > 1 ? 2 : 3, '/ 사용 목록:', listToUse.length, '개');
      setBuildingExposList(listToUse);

      if (data.title || listToUse.length > 0) {
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
    const totalParking = (Number(title?.indrAutoUtcnt) || 0)
      + (Number(title?.indrMechUtcnt) || 0)
      + (Number(title?.oudrAutoUtcnt) || 0)
      + (Number(title?.oudrMechUtcnt) || 0);
    setForm(prev => ({
      ...prev,
      building_name: title?.bldNm || buildingName || prev.building_name,
      usage_type: title?.etcPurps || prev.usage_type,
      total_floor: title?.grndFlrCnt ? String(title.grndFlrCnt) : prev.total_floor,
      approval_date: formatYmd(title?.useAprDay) || prev.approval_date,
      elevator: Number(title?.rideUseElvtCnt) > 0 ? true : prev.elevator,
      total_parking: totalParking > 0 ? String(totalParking) : prev.total_parking,
    }));
  };

  // YYYYMMDD → YYYY-MM-DD
  const formatYmd = (ymd: any): string => {
    if (!ymd) return '';
    const s = String(ymd);
    if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return s;
  };

  // ── 호수별 면적 조회 → areaCache에만 저장
  const fetchAreaForHo = async (hoNm: string) => {
    if (!lastBuildingParams.sigunguCd) return;
    if (areaCache[hoNm]) {
      console.log('[면적] 캐시 히트 — 재조회 생략:', hoNm);
      return;
    }
    const params = new URLSearchParams({
      sigunguCd: lastBuildingParams.sigunguCd,
      bjdongCd: lastBuildingParams.bjdongCd,
      bun: lastBuildingParams.bun,
      ji: lastBuildingParams.ji,
      ho: hoNm,
    });
    console.log('[면적] 조회 시작:', hoNm);
    setAreaLoading(true);
    try {
      const res = await fetch(`/api/building?${params}`);
      const data = await res.json();
      if (data.areaItems && data.areaItems.length > 0) {
        const 전유 = data.areaItems.find((item: any) => item.exposPubuseGbCdNm === '전유');
        const 공용들 = data.areaItems.filter((item: any) => item.exposPubuseGbCdNm === '공용');
        const 공용합계 = 공용들.reduce((sum: number, item: any) => sum + (Number(item.area) || 0), 0);
        const exclusive = Number(전유?.area) || 0;
        const currentFloor = 전유?.flrNo
          ? (전유.flrGbCdNm === '지하' ? `지하${Math.abs(전유.flrNo)}` : String(전유.flrNo))
          : undefined;
        const usageType = 전유?.etcPurps || 전유?.mainPurpsCdNm || undefined;
        console.log('[면적] 조회 결과:', hoNm, '→ 전용:', exclusive, '공용:', 공용합계, '층:', currentFloor);
        setAreaCache(prev => ({ ...prev, [hoNm]: { exclusive, publicArea: 공용합계, currentFloor, usageType } }));
      } else {
        console.warn('[면적] 응답에 areaItems 없음:', hoNm, data);
      }
    } catch (err) {
      console.error('[면적 조회] 실패:', hoNm, err);
    } finally {
      setAreaLoading(false);
    }
  };

  // ── 멀티셀렉트 드롭다운 변경 핸들러
  const handleMultiSelect = async (next: string[]) => {
    console.log('[호실선택] onChange 호출 — 이전:', selectedBldHos, '→ 새 선택:', next);
    const added = next.filter(d => !selectedBldHos.includes(d));
    console.log('[호실선택] 새로 추가된 호실:', added);
    setSelectedBldHos(next);
    for (const display of added) {
      const match = buildingExposList.find(e => e.display === display);
      if (!match) continue;
      if (match.hoNm) {
        await fetchAreaForHo(match.hoNm);
      } else {
        // 호실 없음 (단독/단일 건물의 층별 정보) → exposList의 area 직접 사용
        const exclusive = parseFloat(match.area || '0') || 0;
        const currentFloor = match.flrNo ? String(match.flrNo) : undefined;
        const usageType = match.etcPurps || undefined;
        console.log('[층선택] exposList 직접 사용:', display, '→ 면적:', exclusive, '층:', currentFloor);
        setAreaCache(prev => ({ ...prev, [display]: { exclusive, publicArea: 0, currentFloor, usageType } }));
      }
    }
    console.log('[호실선택] 추가 조회 완료');
  };

  // ── 선택된 호실/층 변경 시 면적/층/용도 합산·반영
  useEffect(() => {
    if (selectedBldHos.length === 0) return;
    let totalEx = 0;
    let totalPub = 0;
    let firstFloor: string | undefined;
    let firstUsage: string | undefined;
    const rows: Array<{ display: string; cacheKey: string; cached: boolean; exclusive: number; publicArea: number }> = [];
    for (const display of selectedBldHos) {
      const match = buildingExposList.find(e => e.display === display);
      if (!match) {
        rows.push({ display, cacheKey: '(없음)', cached: false, exclusive: 0, publicArea: 0 });
        continue;
      }
      const cacheKey = match.hoNm || match.display;
      const cached = areaCache[cacheKey];
      if (!cached) {
        rows.push({ display, cacheKey, cached: false, exclusive: 0, publicArea: 0 });
        continue;
      }
      totalEx += cached.exclusive;
      totalPub += cached.publicArea;
      if (!firstFloor && cached.currentFloor) firstFloor = cached.currentFloor;
      if (!firstUsage && cached.usageType) firstUsage = cached.usageType;
      rows.push({ display, cacheKey, cached: true, exclusive: cached.exclusive, publicArea: cached.publicArea });
    }
    const totalSupply = totalEx + totalPub;
    console.log('[면적합산] 선택된 호실:', selectedBldHos.length, '개 / 캐시된 호실:', rows.filter(r => r.cached).length, '개');
    console.table(rows);
    console.log('[면적합산] 총 전용:', totalEx.toFixed(2), '㎡ / 총 공용:', totalPub.toFixed(2), '㎡ / 총 공급:', totalSupply.toFixed(2), '㎡');

    setForm(prev => ({
      ...prev,
      exclusive_area: totalEx ? String(Math.round(totalEx * 100) / 100) : prev.exclusive_area,
      supply_area: totalSupply ? String(Math.round(totalSupply * 100) / 100) : prev.supply_area,
      current_floor: firstFloor || prev.current_floor,
      usage_type: firstUsage || prev.usage_type,
    }));
  }, [selectedBldHos, areaCache, buildingExposList]);

  // ── 이미지 전체 삭제
  const removeAllImages = async () => {
    if (existingImages.length === 0 && newImages.length === 0) return;
    if (!confirm('이미지를 전부 삭제하시겠습니까?')) return;

    // 새 이미지(로컬): preview URL 해제
    newImages.forEach(img => URL.revokeObjectURL(img.preview));
    setNewImages([]);

    // 기존 이미지: R2 공유 체크 후 삭제
    for (const img of existingImages) {
      const { count } = await supabase
        .from('property_images')
        .select('*', { count: 'exact', head: true })
        .eq('image_url', img.image_url);
      const isShared = (count ?? 1) > 1;
      if (!isShared) {
        await deleteImageFromR2(img.image_url);
      }
    }
    if (existingImages.length > 0) {
      await supabase.from('property_images').delete().eq('property_id', propertyId);
    }
    setExistingImages([]);
  };

  // ── 기존 이미지 삭제 (다른 매물과 공유된 URL이면 R2 파일은 보존)
  const removeExistingImage = async (img: { id: string; image_url: string }) => {
    const { count, error: countErr } = await supabase
      .from('property_images')
      .select('*', { count: 'exact', head: true })
      .eq('image_url', img.image_url);
    if (countErr) console.warn('[이미지 공유 확인 실패]', countErr);
    const isShared = (count ?? 1) > 1;
    if (!isShared) {
      await deleteImageFromR2(img.image_url);
    } else {
      console.log('[이미지 삭제] 다른 매물과 공유 중 — R2 파일 보존:', img.image_url);
    }
    await supabase.from('property_images').delete().eq('id', img.id);
    setExistingImages(prev => prev.filter(i => i.id !== img.id));
  };

  // ── 이미지 드래그 정렬
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );
  const handleExistingDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setExistingImages(prev => {
      const oldIdx = prev.findIndex(img => img.id === active.id);
      const newIdx = prev.findIndex(img => img.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };
  const handleNewDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setNewImages(prev => {
      const oldIdx = prev.findIndex(img => img.preview === active.id);
      const newIdx = prev.findIndex(img => img.preview === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  // ── 새 이미지 추가
  const addImageFiles = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const remaining = 15 - existingImages.length - newImages.length;
    if (remaining <= 0) { alert('최대 15장까지 업로드 가능합니다.'); return; }
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

  const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

  const resolveLandlord = async (params: {
    name: string; phone: string; address: string;
    buildingName: string; unitNumber: string; currentPropertyId?: string;
  }): Promise<{ landlord_id: string | null; landlord_name: string; landlord_phone: string; matchMsg?: string }> => {
    const { name, phone, address, buildingName, unitNumber, currentPropertyId } = params;
    const nameStr = name.trim();
    const phoneStr = phone.trim();

    console.log('[임대인매칭] 시작', params);

    if (!nameStr && !phoneStr) {
      const result = { landlord_id: null, landlord_name: '', landlord_phone: '' };
      console.log('[임대인매칭] 최종 결과', result);
      return result;
    }

    // 1순위: 주소+동호수 매칭
    if (address.trim() && unitNumber.trim()) {
      let q = supabase.from('properties').select('landlord_id')
        .eq('address', address.trim()).eq('unit_number', unitNumber.trim())
        .not('landlord_id', 'is', null);
      if (currentPropertyId) q = q.neq('id', currentPropertyId);
      const { data: matchedProps } = await q.limit(1);
      console.log('[임대인매칭] 1순위 검색 결과', matchedProps);

      if (matchedProps && matchedProps.length > 0) {
        const matchedLandlordId = matchedProps[0].landlord_id as string;
        const { data: landlord } = await supabase.from('landlords').select('id, name, phone')
          .eq('id', matchedLandlordId).single();

        const unitLabel = [buildingName.trim(), unitNumber.trim()].filter(Boolean).join(' ');
        const addrLine = [address.trim(), unitLabel].filter(Boolean).join(' ');
        const infoLine = [addrLine || null, landlord?.phone || null].filter(Boolean).join(' / ');
        const ok = confirm(`${infoLine}\n같은 임대인이 있습니다.\n보유 매물에 추가할까요?`);
        console.log('[임대인매칭] 1순위 confirm 응답', ok);

        if (ok) {
          const result = landlord
            ? { landlord_id: landlord.id, landlord_name: landlord.name ?? nameStr, landlord_phone: landlord.phone ?? phoneStr, matchMsg: `기존 임대인 ${landlord.name}에 연결되었습니다.` }
            : { landlord_id: matchedLandlordId, landlord_name: nameStr, landlord_phone: phoneStr, matchMsg: '기존 임대인에 연결되었습니다.' };
          console.log('[임대인매칭] 최종 결과', result);
          return result;
        }
        // [취소] → 2순위로
      }
    }

    // 2순위: 전화번호 매칭
    if (phoneStr) {
      const normalizedInput = normalizePhone(phoneStr);
      if (normalizedInput.length >= 9) {
        const { data: allLandlords } = await supabase.from('landlords').select('id, name, phone').not('phone', 'is', null);
        const matched = (allLandlords ?? []).find(l => normalizePhone(l.phone ?? '') === normalizedInput);
        console.log('[임대인매칭] 2순위 검색 결과', matched ?? '없음');

        if (matched) {
          const infoLine = [matched.phone].filter(Boolean).join(' / ');
          const ok = confirm(`${infoLine}\n같은 임대인이 있습니다.\n보유 매물에 추가할까요?`);
          console.log('[임대인매칭] 2순위 confirm 응답', ok);

          if (ok) {
            const result = { landlord_id: matched.id, landlord_name: nameStr, landlord_phone: phoneStr, matchMsg: `기존 임대인 ${matched.name}에 연결되었습니다.` };
            console.log('[임대인매칭] 최종 결과', result);
            return result;
          }
          // [취소] → 신규 등록
        }
      }
    }

    // 신규 등록
    if (phoneStr) {
      const { data: newLandlord, error: insertErr } = await supabase.from('landlords')
        .insert({ name: nameStr || null, phone: phoneStr }).select('id, name, phone').single();
      if (insertErr || !newLandlord) {
        console.error('[임대인매칭] 신규 등록 실패:', insertErr);
        const result = { landlord_id: null, landlord_name: nameStr, landlord_phone: phoneStr };
        console.log('[임대인매칭] 최종 결과', result);
        return result;
      }
      console.log('[임대인매칭] 신규 등록', newLandlord.id);
      const result = { landlord_id: newLandlord.id, landlord_name: nameStr, landlord_phone: phoneStr, matchMsg: `임대인 ${nameStr || phoneStr}이(가) 새로 등록되었습니다.` };
      console.log('[임대인매칭] 최종 결과', result);
      return result;
    }

    // 전화번호 없이 이름만 → 텍스트만 저장
    const result = { landlord_id: null, landlord_name: nameStr, landlord_phone: '' };
    console.log('[임대인매칭] 최종 결과', result);
    return result;
  };

  // ── 저장 (UPDATE)
  const handleSave = async () => {
    console.log('[수정] handleSave 시작 — landlord_name:', form.landlord_name, '| phone:', form.landlord_phone);

    setSaving(true);

    try {
      // 임대인 변경 여부 확인
      const orig = origLandlordRef.current;
      const landlordChanged = form.landlord_name !== orig.name || form.landlord_phone !== orig.phone;

      let resolvedLandlordId: string | null = form.landlord_id || null;
      let resolvedLandlordName = form.landlord_name;
      let resolvedLandlordPhone = form.landlord_phone;
      let landlordMatchMsg: string | undefined;

      if (!landlordChanged && orig.id) {
        console.log('[임대인매칭] 변경 없음 → 기존 ID 유지:', orig.id);
      } else {
        const resolved = await resolveLandlord({
          name: form.landlord_name,
          phone: form.landlord_phone,
          address: form.address,
          buildingName: form.building_name,
          unitNumber: form.unit_number,
          currentPropertyId: propertyId,
        });
        resolvedLandlordId = resolved.landlord_id;
        resolvedLandlordName = resolved.landlord_name;
        resolvedLandlordPhone = resolved.landlord_phone;
        landlordMatchMsg = resolved.matchMsg;
      }

      const row: any = {
        transaction_type: form.transaction_type,
        property_type: form.property_type,
        usage_type: form.usage_type || null,
        theme_type: form.theme_types.length > 0 ? form.theme_types.join(',') : null,
        title: form.title || null,
        address: form.address,
        land_number: form.land_number || null,
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
        business_name: form.business_name?.trim() || null,
        business_name_public: !!form.business_name_public,
        unit_number: form.unit_number || null,
        direction: form.direction || null,
        parking: form.parking,
        elevator: form.elevator,
        total_parking: form.total_parking ? parseInt(form.total_parking) : null,
        room_count: form.room_count ? parseInt(form.room_count) : null,
        bathroom_count: form.bathroom_count ? parseInt(form.bathroom_count) : null,
        available_date: (() => {
          const parts = [
            form.available_date || '',
            form.available_immediate && '즉시입주',
            form.available_negotiable && '협의가능',
          ].filter(Boolean);
          return parts.length > 0 ? parts.join('/') : null;
        })(),
        approval_date: form.approval_date || null,
        status: form.status,
        is_sold: form.status === '거래완료', // 하위호환: status === '거래완료'일 때 true
        description: form.description || null,
        admin_memo: form.admin_memo || null,
        landlord_id: resolvedLandlordId,
        landlord_name: resolvedLandlordName || null,
        landlord_phone: resolvedLandlordPhone || null,
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

      // 새 이미지 R2 업로드 (병렬)
      const startIdx = existingImages.length;
      const uploadResults = await Promise.all(
        newImages.map(async (img, i) => {
          try {
            const publicUrl = await uploadImageToR2(img.file);
            return { i, publicUrl };
          } catch (err) {
            console.error('R2 업로드 실패:', err);
            return null;
          }
        })
      );

      const insertRows = uploadResults
        .filter((r): r is { i: number; publicUrl: string } => r !== null)
        .map(({ i, publicUrl }) => ({
          property_id: propertyId,
          image_url: publicUrl,
          order_index: startIdx + i,
        }));

      if (insertRows.length > 0) {
        await supabase.from('property_images').insert(insertRows);
      }

      if (landlordMatchMsg) showToast(landlordMatchMsg);
      alert('매물이 수정되었습니다.');
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push(`/item/view/${form.property_number}`);
      }
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

        {/* ════════════ 매물 상태 ════════════ */}
        {(() => {
          const statusInfo: Record<'거래중' | '보류' | '거래완료', { bg: string; border: string; text: string; desc: string }> = {
            '거래중':   { bg: '#fff', border: '#e0e0e0', text: '#333',     desc: '사이트에 정상 노출됩니다.' },
            '보류':     { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', desc: '사이트에서 숨겨집니다 (관리자만 볼 수 있음).' },
            '거래완료': { bg: '#fff0f0', border: '#e04a4a', text: '#e04a4a', desc: '매물 카드에 "거래완료" 도장이 표시됩니다.' },
          };
          const cur = statusInfo[form.status];
          return (
            <div className="admin-sold-row" style={{ background: cur.bg, border: `2px solid ${cur.border}`, borderRadius: '8px', padding: '16px 24px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: cur.text }}>매물 상태: {form.status}</span>
                  <p style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>{cur.desc}</p>
                </div>
                <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid #ddd', flexShrink: 0 }}>
                  {(['거래중', '보류', '거래완료'] as const).map((s, i) => {
                    const active = form.status === s;
                    const info = statusInfo[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set('status', s)}
                        style={{
                          padding: '8px 16px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                          background: active ? info.text : '#fff',
                          color: active ? '#fff' : '#666',
                          border: 'none',
                          borderLeft: i === 0 ? 'none' : '1px solid #ddd',
                        }}
                      >{s}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

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
          {/* 건축물대장 건물명/호 정보 */}
          <div style={{ marginTop: '12px', padding: '12px', background: '#fff6ef', border: '1px solid #f0d4b8', borderRadius: '6px' }}>
            <div style={{ fontSize: '12px', color: '#8a5a2a', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              🏢 건물명/호 정보
              {buildingLoading && <span style={{ color: '#e2a06e', fontWeight: 500 }}>· 건축물대장 조회 중...</span>}
              {!buildingLoading && buildingExposList.length > 0 && (() => {
                const hasHo = buildingExposList.some(e => !!e.hoNm);
                return <span style={{ color: '#888', fontWeight: 500 }}>· {buildingExposList.length}개 {hasHo ? '호실' : '층'} 조회됨</span>;
              })()}
              {areaLoading && <span style={{ color: '#e2a06e', fontWeight: 500 }}>· 면적 조회 중...</span>}
            </div>
            <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ ...labelSt, fontSize: '12px' }}>건물명</label>
                <input value={form.building_name} onChange={e => set('building_name', e.target.value)} placeholder="예: 삼성빌딩" style={inputSt} disabled={buildingLoading} />
              </div>
              <div>
                <label style={{ ...labelSt, fontSize: '12px' }}>동호수 (직접 입력)</label>
                <input
                  value={form.unit_number}
                  onChange={e => set('unit_number', e.target.value)}
                  placeholder="예) 101호, B101호, 101동 102호"
                  style={inputSt}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ ...labelSt, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span>상호명 <span style={{ color: '#aaa', fontWeight: 400 }}>(선택)</span></span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500, color: '#555', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.business_name_public}
                      onChange={e => set('business_name_public', e.target.checked)}
                      style={{ width: '14px', height: '14px', accentColor: '#e2a06e', cursor: 'pointer' }}
                    />
                    손님에게 공개
                  </label>
                </label>
                <input
                  value={form.business_name}
                  onChange={e => set('business_name', e.target.value)}
                  placeholder="예: GS25, 스타벅스 부천중동점"
                  style={inputSt}
                />
                <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>현재 운영 중인 상호명 (양도양수 매물 등에 활용). 비공개 시 관리자만 확인 가능.</p>
              </div>
            </div>

            {buildingExposList.length > 0 && (() => {
              const hasHo = buildingExposList.some(e => !!e.hoNm);
              const unit = hasHo ? '호실' : '층';
              return (
                <div>
                  <label style={{ ...labelSt, fontSize: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    {unit} 선택 <span style={{ fontWeight: 400, color: '#888' }}>여러 {unit} 선택 가능 (Ctrl/Cmd+클릭)</span>
                    {selectedBldHos.length > 0 && (
                      <span style={{ color: '#e2a06e', fontWeight: 700 }}>· {selectedBldHos.length}개 선택</span>
                    )}
                  </label>
                  <select
                    multiple
                    value={selectedBldHos}
                    onChange={e => {
                      const opts = Array.from(e.target.selectedOptions).map(o => o.value);
                      handleMultiSelect(opts);
                    }}
                    disabled={buildingLoading}
                    style={{
                      width: '100%', minHeight: '140px',
                      border: '1px solid #e0d4b8', borderRadius: '4px',
                      padding: '6px', background: '#fff', fontSize: '13px',
                      outline: 'none',
                    }}
                  >
                    {buildingExposList.map((e, idx) => {
                      const sqm = parseFloat(e.area || '0');
                      const areaStr = sqm > 0 ? ` - ${sqm.toFixed(1)}㎡ (${(sqm / 3.3058).toFixed(1)}평)` : '';
                      return (
                        <option key={`${e.display}-${idx}`} value={e.display}>
                          {e.display || '(호 없음)'}{e.etcPurps ? ` (${e.etcPurps})` : ''}{areaStr}
                        </option>
                      );
                    })}
                  </select>
                  {selectedBldHos.length > 0 && (
                    <p style={{ fontSize: '11px', color: '#666', marginTop: '6px', lineHeight: 1.5 }}>
                      선택된 {unit}: <strong style={{ color: '#8a5a2a' }}>{selectedBldHos.join(', ')}</strong> → 면적 자동 합산됨
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
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
            <div>
              <label style={labelSt}>
                공급면적 (㎡)
                {form.supply_area && !isNaN(parseFloat(form.supply_area)) && (
                  <span style={{ fontSize: '11px', color: '#888', fontWeight: 400, marginLeft: '6px' }}>
                    ({(parseFloat(form.supply_area) / 3.3058).toFixed(1)}평)
                  </span>
                )}
              </label>
              <input value={form.supply_area} onChange={e => set('supply_area', e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>
                전용면적 (㎡)
                {form.exclusive_area && !isNaN(parseFloat(form.exclusive_area)) && (
                  <span style={{ fontSize: '11px', color: '#888', fontWeight: 400, marginLeft: '6px' }}>
                    ({(parseFloat(form.exclusive_area) / 3.3058).toFixed(1)}평)
                  </span>
                )}
              </label>
              <input value={form.exclusive_area} onChange={e => set('exclusive_area', e.target.value)} style={inputSt} />
            </div>
            <div><label style={labelSt}>현재층</label><input value={form.current_floor} onChange={e => set('current_floor', e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>전체층</label><input value={form.total_floor} onChange={e => set('total_floor', e.target.value)} style={inputSt} /></div>
            <div><label style={labelSt}>총 주차대수</label><input value={form.total_parking} onChange={e => set('total_parking', e.target.value)} placeholder="예: 8" style={inputSt} /></div>
            <div>
              <label style={labelSt}>방수/욕실수</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="number" value={form.room_count} onChange={e => set('room_count', e.target.value)} placeholder="방 수" style={{ ...inputSt, flex: 1 }} />
                <span style={{ fontSize: '16px', color: '#888' }}>/</span>
                <input type="number" value={form.bathroom_count} onChange={e => set('bathroom_count', e.target.value)} placeholder="욕실 수" style={{ ...inputSt, flex: 1 }} />
              </div>
            </div>
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
              <input type="date" value={form.available_date} onChange={e => set('available_date', e.target.value)} style={inputSt} />
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
            {[{ key: 'parking', label: '주차 가능' }, { key: 'elevator', label: '엘리베이터' }].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', color: '#444' }}>
                <input type="checkbox" checked={(form as any)[key]} onChange={e => set(key, e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#e2a06e' }} /> {label}
              </label>
            ))}
          </div>
        </div>

        {/* ════════════ 매물 설명 ════════════ */}
        <div className="admin-section" style={sectionSt}>
          <h2 className="admin-section-title" style={sectionTitle}>매물 설명</h2>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={12} style={{ width: '100%', minHeight: '280px', border: '1px solid #ddd', borderRadius: '6px', padding: '12px', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.8', fontFamily: 'inherit' }} />
        </div>

        {/* ════════════ 매물 제목 ════════════ */}
        <div className="admin-section" style={sectionSt}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a1a' }}>매물 제목</h2>
            <button
              type="button"
              onClick={() => set('title', generateTitle(form))}
              style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '4px', border: '1px solid #e2a06e', color: '#e2a06e', background: '#fff', cursor: 'pointer' }}
            >
              ✨ 타이틀 자동생성
            </button>
          </div>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="예) [부천 중동 상가 월세] 전용 10평 초역세권 무권리" style={inputSt} />
        </div>

        {/* ════════════ 관리자 메모 ════════════ */}
        <div className="admin-section" style={{ ...sectionSt, background: '#fffdf0', border: '1px solid #f0e6b8' }}>
          <h2 style={{ ...sectionTitle, borderBottom: '2px solid #d4a017' }}>🔒 관리자 메모</h2>
          <p style={{ fontSize: '11px', color: '#9a7a17', margin: '0 0 8px', padding: '6px 10px', background: '#fff8d6', borderRadius: '4px', border: '1px solid #f0e6b8' }}>
            💡 상호명은 위 <strong>기본 정보 → 상호명</strong> 칸을 사용해주세요. 메모는 영업 정보용입니다.
          </p>
          <textarea value={form.admin_memo} onChange={e => set('admin_memo', e.target.value)} placeholder="관리자 전용 메모" style={{ width: '100%', minHeight: '120px', border: '1px solid #e0d8a8', borderRadius: '6px', padding: '12px', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.8', fontFamily: 'inherit', background: '#fffef8' }} />
        </div>

        {/* ════════════ 연락처 (관리자 전용) ════════════ */}
        <div className="admin-section" style={{ ...sectionSt, background: '#f0f6ff', border: '1px solid #c6dcf3' }}>
          <h2 style={{ ...sectionTitle, borderBottom: '2px solid #4a7cdc' }}>🔒 연락처 <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 400 }}>(관리자 전용)</span></h2>

          <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelSt}>임대인 이름</label>
              <input value={form.landlord_name} onChange={e => set('landlord_name', e.target.value)} placeholder="예: 김철수" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>임대인 전화번호</label>
              <input value={form.landlord_phone} onChange={e => set('landlord_phone', e.target.value)} placeholder="예: 010-1234-5678" style={inputSt} />
            </div>
          </div>
          <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a1a' }}>이미지 ({totalImages}/15)</h2>
            {totalImages > 0 && (
              <button
                type="button"
                onClick={removeAllImages}
                style={{ padding: '6px 12px', fontSize: '12px', background: '#fff', border: '1px solid #e05050', color: '#e05050', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                전체삭제
              </button>
            )}
          </div>
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
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleExistingDragEnd}>
              <SortableContext items={existingImages.map(img => img.id)} strategy={rectSortingStrategy}>
                {existingImages.map((img, i) => (
                  <SortableEditImageItem key={img.id} id={img.id} src={img.image_url} index={i} onRemove={() => removeExistingImage(img)} />
                ))}
              </SortableContext>
            </DndContext>

            {/* 새 이미지 */}
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleNewDragEnd}>
              <SortableContext items={newImages.map(img => img.preview)} strategy={rectSortingStrategy}>
                {newImages.map((img, i) => (
                  <SortableEditImageItem key={img.preview} id={img.preview} src={img.preview} index={existingImages.length + i} badge={{ label: 'NEW', bg: '#4caf50' }} borderColor="#e2a06e" onRemove={() => removeNewImage(i)} />
                ))}
              </SortableContext>
            </DndContext>

            {totalImages < 15 && (
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
          <button onClick={() => { window.scrollTo(0, 0); router.back(); }} style={{ height: '48px', padding: '0 32px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '16px', color: '#666', background: '#fff', cursor: 'pointer' }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{ height: '48px', padding: '0 40px', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 700, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#ccc' : '#e2a06e' }}>
            {saving ? '저장 중...' : '매물 수정'}
          </button>
        </div>

      </div>
    </main>
  );
}
