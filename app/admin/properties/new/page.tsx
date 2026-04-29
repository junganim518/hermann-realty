'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { generateTitle } from '@/lib/generateTitle';

declare global {
  interface Window { daum: any; }
}

function SortableImageItem({ img, index, onRemove }: { img: { preview: string }; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.preview });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const, aspectRatio: '1', borderRadius: '6px', overflow: 'hidden' as const,
    border: '1px solid #e0e0e0', background: '#f0f0f0', cursor: 'grab',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <img src={img.preview} alt={`이미지 ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
      {index === 0 && (
        <span style={{ position: 'absolute', top: '4px', left: '4px', background: '#e2a06e', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px' }}>대표</span>
      )}
      <span style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '10px', padding: '1px 5px', borderRadius: '3px' }}>{index + 1}</span>
      <button
        type="button"
        onPointerDown={e => e.stopPropagation()}
        onClick={onRemove}
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

  // ── 건축물대장 관련 상태
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
      if (!document.querySelector('script[src*="dapi.kakao.com/v2/maps/sdk"][src*="libraries=services"]')) {
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
    console.log('[주소검색] window.daum:', !!window.daum, 'Postcode:', !!window.daum?.Postcode);
    console.log('[주소검색] window.kakao:', !!window.kakao, 'maps.services:', !!window.kakao?.maps?.services, 'Geocoder:', !!window.kakao?.maps?.services?.Geocoder);
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
        const jibun = data.jibunAddress || data.autoJibunAddress || '';
        setForm(prev => ({ ...prev, address: addr, land_number: jibun }));
        console.log('[주소] 선택 유형:', data.userSelectedType, '주소:', addr, '지번:', jibun);

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

  // ── (제거됨) 전유부 단일 선택 시 unit_number/current_floor 자동입력 — 수동 입력 전환

  // YYYYMMDD → YYYY-MM-DD
  const formatYmd = (ymd: any): string => {
    if (!ymd) return '';
    const s = String(ymd);
    if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return s;
  };

  // ── 호수별 면적 조회 → areaCache에만 저장 (폼은 useEffect에서 일괄 갱신)
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
        // 호실 있음 → 상세 면적 API 조회
        await fetchAreaForHo(match.hoNm);
      } else {
        // 호실 없음 (단독/단일 건물의 층별 정보) → exposList의 area 직접 사용
        // 캐시 키는 display (예: "1층"), 공용면적은 0으로 처리
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
      // 호실 있으면 hoNm, 없으면 display(층)을 캐시 키로 사용
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

  // ── 이미지 추가 공통 로직
  const addImageFiles = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const remaining = 15 - images.length;
    if (remaining <= 0) { alert('최대 15장까지 업로드 가능합니다.'); return; }

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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setImages(prev => {
      const oldIdx = prev.findIndex(img => img.preview === active.id);
      const newIdx = prev.findIndex(img => img.preview === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
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

      // 2) 이미지 R2 업로드 + property_images INSERT (병렬)
      console.log(`[2] 이미지 업로드 시작 (${images.length}장, 병렬)`);
      const uploadResults = await Promise.all(
        images.map(async (img, i) => {
          try {
            const publicUrl = await uploadImageToR2(img.file);
            console.log(`[2-${i + 1}] R2 업로드 성공:`, publicUrl);
            return { i, publicUrl };
          } catch (err) {
            console.error(`[2-${i + 1}] R2 업로드 실패:`, err);
            return null;
          }
        })
      );

      const insertRows = uploadResults
        .filter((r): r is { i: number; publicUrl: string } => r !== null)
        .map(({ i, publicUrl }) => ({
          property_id: propertyId,
          image_url: publicUrl,
          order_index: i,
        }));

      if (insertRows.length > 0) {
        console.log(`[4] property_images INSERT (${insertRows.length}건)`);
        const { data: imgData, error: imgErr } = await supabase
          .from('property_images')
          .insert(insertRows)
          .select();
        console.log('[4] property_images 결과:', { imgData, imgErr });
        if (imgErr) console.error('[4] property_images INSERT 실패:', imgErr);
      }

      alert('매물이 등록되었습니다.');
      router.push('/admin');
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

          {/* 건축물대장 건물명/호 정보 */}
          <div style={{ marginBottom: '12px', padding: '12px', background: '#fff6ef', border: '1px solid #f0d4b8', borderRadius: '6px' }}>
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
            </div>

            {buildingExposList.length > 0 && (() => {
              const hasHo = buildingExposList.some(e => !!e.hoNm);
              const unit = hasHo ? '호실' : '층';
              return (
                <div>
                  <label style={{ ...labelSt, fontSize: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    {unit} 선택 <span style={{ fontWeight: 400, color: '#888' }}>(Ctrl/Cmd+클릭으로 여러 {unit} 선택 — 전용/공급면적 자동 합산)</span>
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
                    {buildingExposList.map((e, idx) => (
                      <option key={`${e.display}-${idx}`} value={e.display}>
                        {e.display || '(호 없음)'}{e.etcPurps ? ` (${e.etcPurps})` : ''}
                      </option>
                    ))}
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
              <label style={labelSt}>
                공급면적 (㎡)
                {form.supply_area && !isNaN(parseFloat(form.supply_area)) && (
                  <span style={{ fontSize: '11px', color: '#888', fontWeight: 400, marginLeft: '6px' }}>
                    ({(parseFloat(form.supply_area) / 3.3058).toFixed(1)}평)
                  </span>
                )}
              </label>
              <input value={form.supply_area} onChange={e => set('supply_area', e.target.value)} placeholder="예: 85.5" style={inputSt} />
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
              <label style={labelSt}>총 주차대수 <span style={{ fontSize: '11px', color: '#888', fontWeight: 400 }}>(건축물대장 자동입력)</span></label>
              <input value={form.total_parking} readOnly placeholder="주소 검색 시 자동입력" style={{ ...inputSt, background: '#f9f9f9' }} />
            </div>
            <div>
              <label style={labelSt}>방수/욕실수</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="number" value={form.room_count} onChange={e => set('room_count', e.target.value)} placeholder="방 수" style={{ ...inputSt, flex: 1 }} />
                <span style={{ fontSize: '16px', color: '#888' }}>/</span>
                <input type="number" value={form.bathroom_count} onChange={e => set('bathroom_count', e.target.value)} placeholder="욕실 수" style={{ ...inputSt, flex: 1 }} />
              </div>
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
                style={inputSt}
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
            rows={12}
            style={{ width: '100%', minHeight: '280px', border: '1px solid #ddd', borderRadius: '6px', padding: '12px', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.8', fontFamily: 'inherit' }}
          />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a1a' }}>이미지 업로드 <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 400 }}>({images.length}/15 — 드래그로 순서 변경)</span></h2>
            {images.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!confirm('이미지를 전부 삭제하시겠습니까?')) return;
                  images.forEach(img => URL.revokeObjectURL(img.preview));
                  setImages([]);
                }}
                style={{ padding: '6px 12px', fontSize: '12px', background: '#fff', border: '1px solid #e05050', color: '#e05050', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                전체삭제
              </button>
            )}
          </div>

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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={images.map(img => img.preview)} strategy={rectSortingStrategy}>
                {images.map((img, i) => (
                  <SortableImageItem key={img.preview} img={img} index={i} onRemove={() => removeImage(i)} />
                ))}
              </SortableContext>
            </DndContext>

            {/* 추가 버튼 */}
            {images.length < 15 && (
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
            onClick={() => { window.scrollTo(0, 0); router.back(); }}
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
