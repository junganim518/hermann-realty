'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const STATUS_COLORS: Record<string, string> = {
  '상담중': '#2196F3', '방문예정': '#e2a06e', '방문완료': '#4caf50',
  '계약진행': '#ff9800', '계약완료': '#9c27b0', '보류': '#999',
};

const TX_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  '월세': { bg: '#fff8f2', border: '#e2a06e', text: '#e2a06e' },
  '전세': { bg: '#eef4ff', border: '#4a80e8', text: '#4a80e8' },
  '매매': { bg: '#fff0f0', border: '#e05050', text: '#e05050' },
};

const PROP_TYPES = ['전체', '상가', '사무실', '오피스텔', '아파트', '건물', '기타'];
const TX_TYPES = ['전체', '월세', '전세', '매매'];
const SOLD_TYPES = ['전체', '거래중', '거래완료'];
const AREA_RANGES = ['전체', '10평 이하', '10~20평', '20~30평', '30~50평', '50평 이상'];
const DEPOSIT_RANGES = ['전체', '1000만 이하', '1000만~2000만', '2000만~3000만', '3000만~4000만', '4000만~5000만', '5000만 이상'];
const RENT_RANGES = ['전체', '50만 이하', '50만~100만', '100만~150만', '150만~200만', '200만~300만', '300만~400만', '400만~500만', '500만 이상'];
const PREMIUM_RANGES = ['전체', '1000만 이하', '1000만~2000만', '2000만~3000만', '3000만~4000만', '4000만~5000만', '5000만 이상'];
const FLOOR_RANGES = ['전체', '지하', '1층', '2층 이상'];
const PAGE_SIZE = 20;

const matchArea = (exclusiveArea: any, supplyArea: any, range: string) => {
  if (range === '전체') return true;
  const sqm = parseFloat(exclusiveArea) || parseFloat(supplyArea);
  if (isNaN(sqm) || !sqm) return false;
  if (range === '10평 이하') return sqm <= 33.058;
  if (range === '10~20평') return sqm > 33.058 && sqm <= 66.116;
  if (range === '20~30평') return sqm > 66.116 && sqm <= 99.174;
  if (range === '30~50평') return sqm > 99.174 && sqm <= 165.29;
  if (range === '50평 이상') return sqm > 165.29;
  return true;
};

const matchDeposit = (deposit: any, range: string) => {
  if (range === '전체') return true;
  const v = Number(deposit);
  if (isNaN(v)) return false;
  if (range === '1000만 이하') return v <= 1000;
  if (range === '1000만~2000만') return v > 1000 && v <= 2000;
  if (range === '2000만~3000만') return v > 2000 && v <= 3000;
  if (range === '3000만~4000만') return v > 3000 && v <= 4000;
  if (range === '4000만~5000만') return v > 4000 && v <= 5000;
  if (range === '5000만 이상') return v > 5000;
  return true;
};

const matchRent = (rent: any, range: string) => {
  if (range === '전체') return true;
  const v = Number(rent);
  if (isNaN(v)) return false;
  if (range === '50만 이하') return v <= 50;
  if (range === '50만~100만') return v > 50 && v <= 100;
  if (range === '100만~150만') return v > 100 && v <= 150;
  if (range === '150만~200만') return v > 150 && v <= 200;
  if (range === '200만~300만') return v > 200 && v <= 300;
  if (range === '300만~400만') return v > 300 && v <= 400;
  if (range === '400만~500만') return v > 400 && v <= 500;
  if (range === '500만 이상') return v > 500;
  return true;
};

const matchPremium = (premium: any, range: string) => {
  if (range === '전체') return true;
  const v = Number(premium);
  if (isNaN(v) || !v) return range === '전체';
  if (range === '1000만 이하') return v <= 1000;
  if (range === '1000만~2000만') return v > 1000 && v <= 2000;
  if (range === '2000만~3000만') return v > 2000 && v <= 3000;
  if (range === '3000만~4000만') return v > 3000 && v <= 4000;
  if (range === '4000만~5000만') return v > 4000 && v <= 5000;
  if (range === '5000만 이상') return v > 5000;
  return true;
};

const matchFloor = (floor: any, range: string) => {
  if (range === '전체') return true;
  const s = String(floor ?? '').trim();
  if (!s) return false;
  if (range === '지하') return s.includes('지하') || s.startsWith('-') || s.startsWith('B');
  if (range === '1층') { const n = parseInt(s); return !isNaN(n) && n === 1; }
  if (range === '2층 이상') { const n = parseInt(s); return !isNaN(n) && n >= 2; }
  return true;
};

const formatPrice = (v: number) => {
  if (!v) return '-';
  const uk = Math.floor(v / 10000);
  const man = v % 10000;
  if (uk > 0) return man > 0 ? `${uk}억 ${man.toLocaleString()}만` : `${uk}억`;
  return `${v.toLocaleString()}만`;
};

const buildPriceStr = (p: any) => {
  if (p.transaction_type === '매매') {
    const v = p.sale_price || p.deposit;
    return v ? formatPrice(v) : '-';
  }
  const parts = [
    p.deposit ? `보 ${formatPrice(p.deposit)}` : null,
    p.monthly_rent ? `월 ${formatPrice(p.monthly_rent)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '-';
};

const formatDate = (d: string | null) => {
  if (!d) return '-';
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}.${pad(dt.getMonth() + 1)}.${pad(dt.getDate())}`;
};

const formatAddr = (p: any) => {
  const addr = p.address || '';
  const extra = [p.building_name, p.unit_number].filter(Boolean).join(' ');
  return extra ? `${addr} ${extra}` : addr || '-';
};

export default function AdminDashboard() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [stats, setStats] = useState({ total: 0, wolse: 0, jeonse: 0, maemae: 0, sold: 0 });
  const [visitors, setVisitors] = useState({ today: 0, week: 0, total: 0 });
  type RefTableRow = { referrer: string; page: string; count: number };
  const [referralTable, setReferralTable] = useState<{ today: RefTableRow[]; total: RefTableRow[] }>({ today: [], total: [] });
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [referralTab, setReferralTab] = useState<'today' | 'total'>('today');
  const [todayVisitors, setTodayVisitors] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [propImages, setPropImages] = useState<Record<string, string>>({});
  const [unreadInquiries, setUnreadInquiries] = useState(0);

  // 검색 & 필터 & 페이지
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('전체');
  const [filterTx, setFilterTx] = useState('전체');
  const [filterSold, setFilterSold] = useState('전체');
  const [filterArea, setFilterArea] = useState('전체');
  const [filterDeposit, setFilterDeposit] = useState('전체');
  const [filterRent, setFilterRent] = useState('전체');
  const [filterFloor, setFilterFloor] = useState('전체');
  const [filterPremium, setFilterPremium] = useState('전체');
  const [page, setPage] = useState(1);
  const [toastMsg, setToastMsg] = useState('');
  const [copying, setCopying] = useState<string | null>(null);

  // 블로그 프롬프트 생성 모달
  const [blogOpen, setBlogOpen] = useState(false);
  const [blogProperty, setBlogProperty] = useState<any>(null);
  const [blogText, setBlogText] = useState('');

  const buildBlogPrompt = (p: any): string => {
    const exArea = p.exclusive_area ? parseFloat(p.exclusive_area) : 0;
    const pyeong = exArea ? (exArea / 3.3058).toFixed(1) : '-';
    const exArearStr = p.exclusive_area ? `${p.exclusive_area}㎡ (${pyeong}평)` : '-';
    const premiumStr = p.premium ? `${p.premium}만원` : '무권리';
    return `당신은 부동산 전문 블로그 작가입니다.
아래 매물 정보를 바탕으로 네이버 블로그에 올릴 정성스러운 블로그 글을 작성해주세요.

작성 규칙:
- 첫 문장은 반드시 "안녕하세요 헤르만부동산입니다." 로 시작
- 도입부: 감성적이고 흥미로운 스토리텔링
- 위치/교통 장점 강조
- 매물 상세 정보 자연스럽게 녹여내기
- 이런 분께 추천 섹션
- 마무리: 헤르만부동산 연락처(010-8680-8151) 포함
- 이모지 적절히 사용
- 전체 길이 1000자 이상
- 구어체로 친근하게
- 해시태그 30개 글 맨 마지막에

매물 정보:
- 매물번호: ${p.property_number ?? ''}
- 매물종류: ${p.property_type ?? ''}
- 거래유형: ${p.transaction_type ?? ''}
- 주소: ${p.address ?? ''}
- 보증금: ${p.deposit ?? 0}만원
- 월세: ${p.monthly_rent ?? 0}만원
- 전용면적: ${exArearStr}
- 층수: ${p.current_floor ?? '-'}
- 권리금: ${premiumStr}
- 관리비: ${p.maintenance_fee ?? 0}만원
- 매물 제목: ${p.title ?? ''}
- 매물 설명: ${p.description ?? ''}`;
  };

  const openBlogModal = (p: any) => {
    setBlogProperty(p);
    setBlogText(buildBlogPrompt(p));
    setBlogOpen(true);
  };

  const closeBlogModal = () => {
    setBlogOpen(false);
    setBlogProperty(null);
    setBlogText('');
  };

  const copyBlogText = async () => {
    if (!blogText) return;
    try {
      await navigator.clipboard.writeText(blogText);
      showToast('프롬프트가 복사되었습니다');
    } catch {
      showToast('복사 실패');
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin'); return; }
      setAuthChecked(true);
      fetchData();
    });
  }, []);

  const fetchData = async () => {
    const { data: props } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });
    const allProps = props ?? [];
    setProperties(allProps);
    setStats({
      total: allProps.length,
      wolse: allProps.filter(p => p.transaction_type === '월세').length,
      jeonse: allProps.filter(p => p.transaction_type === '전세').length,
      maemae: allProps.filter(p => p.transaction_type === '매매').length,
      sold: allProps.filter(p => p.is_sold).length,
    });

    const ids = allProps.map(p => p.id);
    if (ids.length > 0) {
      const { data: imgs } = await supabase
        .from('property_images')
        .select('property_id, image_url, order_index')
        .in('property_id', ids)
        .order('order_index', { ascending: true });
      const imgMap: Record<string, string> = {};
      (imgs ?? []).forEach(img => { if (!imgMap[img.property_id]) imgMap[img.property_id] = img.image_url; });
      setPropImages(imgMap);
    }

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const { data: visitors } = await supabase
      .from('customers')
      .select('*')
      .gte('visit_date', todayStart.toISOString())
      .lte('visit_date', todayEnd.toISOString())
      .order('visit_date', { ascending: true });
    setTodayVisitors(visitors ?? []);

    // 읽지 않은 의뢰 수
    const { count } = await supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('is_read', false);
    setUnreadInquiries(count ?? 0);

    // 방문자 통계
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
    const [todayRes, weekRes, totalRes] = await Promise.all([
      supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
      supabase.from('page_views').select('*', { count: 'exact', head: true }),
    ]);
    setVisitors({
      today: todayRes.count ?? 0,
      week: weekRes.count ?? 0,
      total: totalRes.count ?? 0,
    });

    // 유입 경로 통계
    const { data: views } = await supabase
      .from('page_views')
      .select('referrer, page, created_at');
    if (views) {
      const categorize = (ref: string | null | undefined): string => {
        if (!ref || ref === 'direct') return '직접접속';
        const lower = ref.toLowerCase();
        if (lower.includes('naver')) return '네이버';
        if (lower.includes('google')) return '구글';
        if (lower.includes('kakao')) return '카카오';
        if (lower.includes('daum')) return '다음';
        return ref;
      };

      const buildRows = (rows: typeof views): RefTableRow[] => {
        const nested: Record<string, Record<string, number>> = {};
        for (const v of rows) {
          const referrer = categorize(v.referrer);
          const page = v.page ?? '(unknown)';
          if (!nested[referrer]) nested[referrer] = {};
          nested[referrer][page] = (nested[referrer][page] ?? 0) + 1;
        }
        const out: RefTableRow[] = [];
        Object.keys(nested).forEach(referrer => {
          Object.keys(nested[referrer]).forEach(page => {
            out.push({ referrer, page, count: nested[referrer][page] });
          });
        });
        out.sort((a, b) => b.count - a.count);
        return out;
      };

      const todayTs = todayStart.getTime();
      const todayViews = views.filter(v => new Date(v.created_at).getTime() >= todayTs);
      setReferralTable({
        today: buildRows(todayViews),
        total: buildRows(views),
      });
    }
  };

  const toggleSold = async (id: string, currentSold: boolean) => {
    await supabase.from('properties').update({ is_sold: !currentSold }).eq('id', id);
    setProperties(prev => prev.map(p => p.id === id ? { ...p, is_sold: !currentSold } : p));
    setStats(prev => ({ ...prev, sold: prev.sold + (currentSold ? -1 : 1) }));
  };

  const copyProperty = async (p: any) => {
    if (copying) return;
    setCopying(p.id);
    try {
      // 다음 매물번호 (properties.property_number 최댓값 + 1)
      const { data: maxRows } = await supabase
        .from('properties')
        .select('property_number')
        .order('property_number', { ascending: false })
        .limit(100);
      let maxNum = 9999;
      (maxRows ?? []).forEach((r: any) => {
        const n = parseInt(r.property_number, 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      });
      const nextNumber = String(maxNum + 1);

      // 제외 필드 제거
      const { id: _id, property_number: _pn, created_at: _ca, updated_at: _ua, ...rest } = p;

      const payload = {
        ...rest,
        property_number: nextNumber,
        title: p.title ? `(복사) ${p.title}` : '(복사)',
        is_sold: false,
      };

      const { data: inserted, error } = await supabase
        .from('properties')
        .insert(payload)
        .select('*')
        .single();
      if (error || !inserted) { alert(`복사 실패: ${error?.message ?? '알 수 없는 오류'}`); return; }

      // 이미지 복사 (같은 R2 URL 공유)
      const { data: origImgs, error: origErr } = await supabase
        .from('property_images')
        .select('image_url, order_index')
        .eq('property_id', p.id)
        .order('order_index', { ascending: true });
      if (origErr) console.error('[복사] 원본 이미지 조회 실패:', origErr);
      console.log('[복사] 원본 이미지 개수:', origImgs?.length ?? 0, 'property_id:', p.id);

      if (origImgs && origImgs.length > 0) {
        const imgRows = origImgs.map(img => ({
          property_id: inserted.id,
          image_url: img.image_url,
          order_index: img.order_index,
        }));
        const { data: copiedImgs, error: imgErr } = await supabase
          .from('property_images')
          .insert(imgRows)
          .select();
        if (imgErr) {
          console.error('[복사] property_images INSERT 실패:', imgErr);
          alert(`이미지 복사 실패: ${imgErr.message}`);
        } else {
          console.log('[복사] 이미지 복사 성공:', copiedImgs?.length ?? 0, '개');
        }
      }

      // 로컬 state: 맨 위에 추가
      setProperties(prev => [inserted, ...prev]);
      setPropImages(prev => {
        const firstUrl = origImgs?.[0]?.image_url;
        return firstUrl ? { ...prev, [inserted.id]: firstUrl } : prev;
      });
      setStats(prev => ({
        ...prev,
        total: prev.total + 1,
        wolse: prev.wolse + (inserted.transaction_type === '월세' ? 1 : 0),
        jeonse: prev.jeonse + (inserted.transaction_type === '전세' ? 1 : 0),
        maemae: prev.maemae + (inserted.transaction_type === '매매' ? 1 : 0),
      }));
      setPage(1);
      showToast('복사완료!');

      // 복사된 매물의 수정페이지로 이동
      router.push(`/admin/properties/${inserted.property_number}/edit`);
    } finally {
      setCopying(null);
    }
  };

  const deleteProperty = async (p: any) => {
    if (!confirm(`매물 ${p.property_number}을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    const { data: imgs } = await supabase.from('property_images').select('id, image_url').eq('property_id', p.id);
    if (imgs && imgs.length > 0) {
      // 같은 image_url을 다른 매물이 참조하는지 일괄 확인 후, 공유 안 되는 파일만 R2에서 삭제
      for (const img of imgs) {
        const { count } = await supabase
          .from('property_images')
          .select('*', { count: 'exact', head: true })
          .eq('image_url', img.image_url);
        const isShared = (count ?? 1) > 1;
        if (!isShared) {
          try { await fetch('/api/delete-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: img.image_url }) }); } catch {}
        } else {
          console.log('[매물 삭제] 이미지 공유 중 — R2 보존:', img.image_url);
        }
      }
      await supabase.from('property_images').delete().eq('property_id', p.id);
    }
    const { error } = await supabase.from('properties').delete().eq('id', p.id);
    if (error) { alert(`삭제 실패: ${error.message}`); return; }
    setProperties(prev => prev.filter(x => x.id !== p.id));
    setStats(prev => ({
      ...prev, total: prev.total - 1,
      wolse: prev.wolse - (p.transaction_type === '월세' ? 1 : 0),
      jeonse: prev.jeonse - (p.transaction_type === '전세' ? 1 : 0),
      maemae: prev.maemae - (p.transaction_type === '매매' ? 1 : 0),
      sold: prev.sold - (p.is_sold ? 1 : 0),
    }));
  };

  // 필터링
  const filtered = properties.filter(p => {
    if (filterType !== '전체' && p.property_type !== filterType) return false;
    if (filterTx !== '전체' && p.transaction_type !== filterTx) return false;
    if (filterSold === '거래중' && p.is_sold) return false;
    if (filterSold === '거래완료' && !p.is_sold) return false;
    if (!matchArea(p.exclusive_area, p.supply_area, filterArea)) return false;
    if (!matchDeposit(p.deposit, filterDeposit)) return false;
    if (!matchRent(p.monthly_rent, filterRent)) return false;
    if (!matchFloor(p.current_floor, filterFloor)) return false;
    if (!matchPremium(p.premium, filterPremium)) return false;
    if (search) {
      const q = search.toLowerCase();
      const target = [p.property_number, p.address, p.building_name, p.unit_number, p.admin_memo, p.land_number, p.title, p.description].filter(Boolean).join(' ').toLowerCase();
      if (!target.includes(q)) return false;
    }
    return true;
  });

  const hasActiveFilter = filterType !== '전체' || filterTx !== '전체' || filterSold !== '전체' || filterArea !== '전체' || filterDeposit !== '전체' || filterRent !== '전체' || filterFloor !== '전체' || filterPremium !== '전체' || search;
  const resetAllFilters = () => {
    setSearch(''); setFilterType('전체'); setFilterTx('전체'); setFilterSold('전체');
    setFilterArea('전체'); setFilterDeposit('전체'); setFilterRent('전체'); setFilterFloor('전체'); setFilterPremium('전체');
    resetPage();
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const displayed = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // 필터 변경 시 페이지 리셋
  const resetPage = () => setPage(1);

  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>;

  const cardSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', textAlign: 'center' };
  const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '24px', marginBottom: '20px' };
  const sectionTitleSt: React.CSSProperties = { fontSize: '18px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const selectFilterSt: React.CSSProperties = { height: '36px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 8px', fontSize: '13px', color: '#555', background: '#fff', cursor: 'pointer', outline: 'none', minWidth: '100px' };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>

      {toastMsg && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', color: '#e2a06e', padding: '12px 24px', borderRadius: '8px',
          fontSize: '14px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          zIndex: 9999,
        }}>
          {toastMsg}
        </div>
      )}

      {/* 유입 경로 상세 모달 */}
      {referralModalOpen && (
        <div
          onClick={() => setReferralModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '12px', maxWidth: '760px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 20px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#e2a06e' }}>📊 유입 경로 상세</h3>
              <button onClick={() => setReferralModalOpen(false)} style={{ background: 'none', border: 'none', color: '#e2a06e', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {/* 탭 */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>
              {(['today', 'total'] as const).map(tab => {
                const active = referralTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setReferralTab(tab)}
                    style={{
                      flex: 1, padding: '12px 20px', fontSize: '14px', fontWeight: 700,
                      background: active ? '#fff' : 'transparent',
                      color: active ? '#e2a06e' : '#888',
                      border: 'none',
                      borderBottom: active ? '3px solid #e2a06e' : '3px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {tab === 'today' ? '오늘' : '전체'}
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {(() => {
                const rows = referralTable[referralTab];
                if (rows.length === 0) {
                  return (
                    <p style={{ color: '#aaa', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                      {referralTab === 'today' ? '오늘 방문 기록이 없습니다' : '방문 기록이 없습니다'}
                    </p>
                  );
                }
                const KNOWN = new Set(['네이버', '구글', '카카오', '다음', '직접접속']);
                const badgeStyle = (ref: string): React.CSSProperties => {
                  const map: Record<string, { bg: string; color: string }> = {
                    '네이버': { bg: '#03c75a', color: '#fff' },
                    '구글': { bg: '#4285f4', color: '#fff' },
                    '카카오': { bg: '#fee500', color: '#3c1e1e' },
                    '다음': { bg: '#0066ff', color: '#fff' },
                    '직접접속': { bg: '#888', color: '#fff' },
                  };
                  const c = map[ref] ?? { bg: '#f5f5f5', color: '#555' };
                  return {
                    display: 'inline-block', padding: '3px 8px', borderRadius: '10px',
                    fontSize: '11px', fontWeight: 700, background: c.bg, color: c.color,
                    maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  };
                };
                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#fafafa', borderBottom: '2px solid #e2a06e' }}>
                        <th style={{ textAlign: 'left', padding: '10px 8px', color: '#666', fontWeight: 700, fontSize: '12px', width: '28%' }}>유입경로</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', color: '#666', fontWeight: 700, fontSize: '12px' }}>착지페이지</th>
                        <th style={{ textAlign: 'right', padding: '10px 8px', color: '#666', fontWeight: 700, fontSize: '12px', width: '80px' }}>방문수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={`${r.referrer}-${r.page}-${i}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '10px 8px' }}>
                            <span style={badgeStyle(r.referrer)} title={r.referrer}>
                              {KNOWN.has(r.referrer) ? r.referrer : r.referrer}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', color: '#333', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12px', wordBreak: 'break-all' }}>
                            {r.page}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#333', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setReferralModalOpen(false)}
                style={{ padding: '8px 20px', background: '#1a1a1a', border: '1px solid #1a1a1a', color: '#e2a06e', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 블로그 프롬프트 모달 */}
      {blogOpen && (
        <div
          onClick={closeBlogModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '12px', maxWidth: '720px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 20px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#e2a06e' }}>
                📝 블로그 글 프롬프트
                {blogProperty && (
                  <span style={{ fontSize: '12px', color: '#888', fontWeight: 500, marginLeft: '10px' }}>
                    매물번호 {blogProperty.property_number}
                  </span>
                )}
              </h3>
              <button onClick={closeBlogModal} style={{ background: 'none', border: 'none', color: '#e2a06e', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
                아래 프롬프트를 복사해 ChatGPT / Claude / Gemini 등에 붙여넣어 블로그 글을 생성하세요.
              </p>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.7, color: '#333', margin: 0, background: '#fafafa', padding: '14px', borderRadius: '6px', border: '1px solid #eee' }}>
                {blogText}
              </pre>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={closeBlogModal} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ddd', color: '#666', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                닫기
              </button>
              <button
                onClick={copyBlogText}
                style={{ padding: '8px 20px', background: '#1a1a1a', border: '1px solid #1a1a1a', color: '#e2a06e', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                📋 복사하기
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px', color: '#1a1a1a', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '12px' }}>
          관리자 대시보드
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#C8A96E' }}>
            👁 오늘 {visitors.today.toLocaleString()} · 이번주 {visitors.week.toLocaleString()} · 전체 {visitors.total.toLocaleString()}
          </span>
          <button
            onClick={() => setReferralModalOpen(true)}
            style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', border: '1px solid #1a1a1a', background: '#1a1a1a', color: '#e2a06e', cursor: 'pointer' }}
          >
            📊 유입 경로 보기
          </button>
        </h1>

        {/* 통계 카드 */}
        <div className="admin-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: '총 매물', value: stats.total, color: '#1a1a1a' },
            { label: '월세', value: stats.wolse, color: '#e2a06e' },
            { label: '전세', value: stats.jeonse, color: '#4a80e8' },
            { label: '매매', value: stats.maemae, color: '#e05050' },
            { label: '거래완료', value: stats.sold, color: '#999' },
          ].map(s => (
            <div key={s.label} style={cardSt}>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>{s.label}</p>
              <p style={{ fontSize: '32px', fontWeight: 800, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>


        {/* 오늘 방문 예정 (축소) */}
        <div style={{ ...sectionSt, padding: '16px 20px' }}>
          <div style={{ ...sectionTitleSt, marginBottom: '10px', paddingBottom: '8px' }}>
            <span style={{ fontSize: '15px' }}>오늘 방문 예정 ({todayVisitors.length})</span>
            <a href="/admin/schedule" style={{ fontSize: '12px', color: '#e2a06e', textDecoration: 'none' }}>스케줄 &rarr;</a>
          </div>
          {todayVisitors.length === 0 ? (
            <p style={{ color: '#aaa', fontSize: '13px', textAlign: 'center', padding: '8px 0' }}>오늘 방문 예정 없음</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {todayVisitors.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 0', fontSize: '13px', borderBottom: '1px solid #f5f5f5' }}>
                  <span style={{ fontWeight: 700, minWidth: '50px' }}>{v.name}</span>
                  <span style={{ color: '#888', minWidth: '50px' }}>{v.visit_date ? new Date(v.visit_date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                  <span style={{ color: '#888' }}>{v.phone || ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 바로가기 */}
        <div className="admin-shortcuts">
          {[
            { label: '매물 등록', href: '/admin/properties/new' },
            { label: '손님 관리', href: '/admin/customers' },
            { label: '스케줄', href: '/admin/schedule' },
            { label: '문의 관리', href: '/admin/inquiries' },
          ].map(link => (
            <a key={link.href} href={link.href} style={{ display: 'block', textAlign: 'center', padding: '12px', background: '#1a1a1a', color: '#e2a06e', fontSize: '14px', fontWeight: 700, borderRadius: '6px', textDecoration: 'none', border: '1px solid #333', position: 'relative' }}>
              {link.label}
              {link.href === '/admin/inquiries' && unreadInquiries > 0 && (
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#e05050', color: '#fff', fontSize: '10px', fontWeight: 700, minWidth: '18px', height: '18px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unreadInquiries}</span>
              )}
            </a>
          ))}
        </div>

        {/* ═══ 매물 관리 리스트 ═══ */}
        <div id="property-management-section" style={sectionSt}>
          <div style={sectionTitleSt}>
            <span>매물 관리 ({filtered.length})</span>
            <a href="/admin/properties/new" style={{ fontSize: '13px', color: '#e2a06e', textDecoration: 'none', fontWeight: 600 }}>+ 매물 등록</a>
          </div>

          {/* 검색 & 필터 */}
          <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* 검색바 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid #ddd', flex: 1, maxWidth: '500px' }}>
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); resetPage(); }}
                  placeholder="매물번호, 주소, 건물명 검색"
                  style={{ flex: 1, height: '36px', border: 'none', outline: 'none', fontSize: '13px', padding: '0 12px', background: '#fff' }}
                />
                {search && (
                  <button onClick={() => { setSearch(''); resetPage(); }} style={{ padding: '0 10px', background: '#fff', border: 'none', color: '#999', cursor: 'pointer', fontSize: '16px' }}>×</button>
                )}
              </div>
              {hasActiveFilter && (
                <button onClick={resetAllFilters} style={{ height: '36px', padding: '0 14px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', color: '#e05050', background: '#fff', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>초기화</button>
              )}
            </div>
            {/* 드롭다운 필터 */}
            <div className="admin-filters" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              <select value={filterType} onChange={e => { setFilterType(e.target.value); resetPage(); }} style={selectFilterSt}>
                {PROP_TYPES.map(t => <option key={t} value={t}>{t === '전체' ? '매물종류 전체' : t}</option>)}
              </select>
              <select value={filterTx} onChange={e => { setFilterTx(e.target.value); resetPage(); }} style={selectFilterSt}>
                {TX_TYPES.map(t => <option key={t} value={t}>{t === '전체' ? '거래유형 전체' : t}</option>)}
              </select>
              <select value={filterSold} onChange={e => { setFilterSold(e.target.value); resetPage(); }} style={selectFilterSt}>
                {SOLD_TYPES.map(t => <option key={t} value={t}>{t === '전체' ? '거래상태 전체' : t}</option>)}
              </select>
              <select value={filterArea} onChange={e => { setFilterArea(e.target.value); resetPage(); }} style={selectFilterSt}>
                {AREA_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '면적 전체' : t}</option>)}
              </select>
              <select value={filterDeposit} onChange={e => { setFilterDeposit(e.target.value); resetPage(); }} style={selectFilterSt}>
                {DEPOSIT_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '보증금 전체' : t}</option>)}
              </select>
              <select value={filterRent} onChange={e => { setFilterRent(e.target.value); resetPage(); }} style={selectFilterSt}>
                {RENT_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '월세 전체' : t}</option>)}
              </select>
              <select value={filterPremium} onChange={e => { setFilterPremium(e.target.value); resetPage(); }} style={selectFilterSt}>
                {PREMIUM_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '권리금 전체' : t}</option>)}
              </select>
              <select value={filterFloor} onChange={e => { setFilterFloor(e.target.value); resetPage(); }} style={selectFilterSt}>
                {FLOOR_RANGES.map(t => <option key={t} value={t}>{t === '전체' ? '층수 전체' : t}</option>)}
              </select>
            </div>
          </div>

          {/* 리스트 */}
          {displayed.length === 0 ? (
            <p style={{ color: '#aaa', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>조건에 맞는 매물이 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayed.map(p => {
                const tx = TX_COLORS[p.transaction_type] ?? { bg: '#f5f5f5', border: '#999', text: '#999' };
                return (
                  <div key={p.id} className="admin-prop-row" style={{ background: p.is_sold ? '#fafafa' : '#fff', opacity: p.is_sold ? 0.65 : 1 }}>
                    {/* 썸네일 */}
                    <a href={`/item/view/${p.property_number}`} style={{ width: '64px', height: '64px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#f0f0f0', display: 'block', cursor: 'pointer' }}>
                      {propImages[p.id] ? (
                        <img src={propImages[p.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#bbb' }}>없음</div>
                      )}
                    </a>

                    {/* 정보 영역 */}
                    <div className="admin-prop-info">
                      {/* 1행: 매물번호 + 뱃지 + 타이틀 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a1a' }}>{p.property_number}</span>
                        {p.property_type && (
                          <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '3px', background: '#f5f5f5', color: '#666', border: '1px solid #e0e0e0' }}>{p.property_type}</span>
                        )}
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', background: tx.bg, border: `1px solid ${tx.border}`, color: tx.text }}>{p.transaction_type}</span>
                        {p.title && (
                          <span style={{ fontSize: '13px', color: '#e2a06e', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={p.title}>{p.title}</span>
                        )}
                      </div>
                      {/* 2행: 주소 */}
                      <p style={{ fontSize: '13px', color: '#555', margin: '0 0 4px', lineHeight: 1.4 }}>{formatAddr(p)}</p>
                      {/* 3행: 면적 + 금액 + 권리금 + 관리비 */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '13px', marginBottom: p.admin_memo ? '4px' : '0' }}>
                        {p.exclusive_area && <span style={{ color: '#555' }}>{p.exclusive_area}㎡ ({(parseFloat(p.exclusive_area) / 3.3058).toFixed(1)}평)</span>}
                        {p.current_floor && <span style={{ color: '#555' }}>{String(p.current_floor).trim().endsWith('층') ? p.current_floor : `${p.current_floor}층`}</span>}
                        <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{buildPriceStr(p)}</span>
                        <span style={{ color: '#e05050' }}>{p.premium ? `권리금 ${formatPrice(p.premium)}` : '무권리'}</span>
                        <span style={{ color: '#888' }}>{p.maintenance_fee ? `관리비 ${formatPrice(p.maintenance_fee)}` : '관리비 없음'}</span>
                      </div>
                      {/* 4행: 메모 */}
                      {p.admin_memo && (
                        <p style={{ fontSize: '11px', color: '#999', margin: 0, lineHeight: 1.4, fontStyle: 'italic', overflow: 'hidden', wordBreak: 'break-all', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>메모: {p.admin_memo}</p>
                      )}
                      {/* 5행: 등록일 / 수정일 */}
                      <p style={{ fontSize: '10px', color: '#bbb', margin: '4px 0 0', lineHeight: 1.3 }}>
                        등록 {formatDate(p.created_at)}
                        {p.updated_at && formatDate(p.updated_at) !== formatDate(p.created_at) && ` · 수정 ${formatDate(p.updated_at)}`}
                      </p>
                    </div>

                    {/* 액션 영역 */}
                    <div className="admin-prop-actions">
                      {/* 토글 스위치 */}
                      <div
                        onClick={() => toggleSold(p.id, p.is_sold)}
                        title={p.is_sold ? '거래완료 → 거래중' : '거래중 → 거래완료'}
                        style={{
                          width: '52px', height: '26px', borderRadius: '13px', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                          background: p.is_sold ? '#999' : '#4caf50',
                        }}
                      >
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px',
                          left: p.is_sold ? '28px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }} />
                      </div>
                      <span style={{ fontSize: '10px', color: p.is_sold ? '#999' : '#4caf50', fontWeight: 600 }}>{p.is_sold ? '거래완료' : '거래중'}</span>

                      {/* 복사/블로그/수정/삭제 */}
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button onClick={() => copyProperty(p)} disabled={copying === p.id} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', border: '1px solid #4a80e8', color: '#4a80e8', background: '#fff', cursor: copying === p.id ? 'wait' : 'pointer', opacity: copying === p.id ? 0.6 : 1 }}>
                          {copying === p.id ? '복사중...' : '복사'}
                        </button>
                        <button onClick={() => openBlogModal(p)} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', border: '1px solid #9c27b0', color: '#9c27b0', background: '#fff', cursor: 'pointer' }}>블로그 글</button>
                        <a href={`/admin/properties/${p.property_number}/edit`} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', border: '1px solid #e2a06e', color: '#e2a06e', textDecoration: 'none' }}>수정</a>
                        <button onClick={() => deleteProperty(p)} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', border: '1px solid #e05050', color: '#e05050', background: '#fff', cursor: 'pointer' }}>삭제</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={() => {
                  setPage(p => Math.max(1, p - 1));
                  document.getElementById('property-management-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                disabled={safePage <= 1}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', background: safePage <= 1 ? '#f5f5f5' : '#fff', color: safePage <= 1 ? '#ccc' : '#333', cursor: safePage <= 1 ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600 }}
              >이전</button>
              <span style={{ fontSize: '14px', color: '#666' }}>{safePage} / {totalPages}</span>
              <button
                onClick={() => {
                  setPage(p => Math.min(totalPages, p + 1));
                  document.getElementById('property-management-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                disabled={safePage >= totalPages}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', background: safePage >= totalPages ? '#f5f5f5' : '#fff', color: safePage >= totalPages ? '#ccc' : '#333', cursor: safePage >= totalPages ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600 }}
              >다음</button>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .admin-filters { scrollbar-width: thin; }
        .admin-filters::-webkit-scrollbar { height: 4px; }
        .admin-filters::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
        .admin-shortcuts { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 24px; }
        .admin-prop-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px; border-radius: 6px; border: 1px solid #eee; overflow: hidden; }
        .admin-prop-info { flex: 1; min-width: 0; overflow: hidden; }
        .admin-prop-info p,
        .admin-prop-info span,
        .admin-prop-info div { overflow-wrap: break-word; word-break: break-all; }
        .admin-prop-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex-shrink: 0; }

        @media (min-width: 768px) and (max-width: 1199px) {
          main > div { max-width: 100% !important; padding: 0 16px !important; }
          .admin-stats { grid-template-columns: repeat(5, 1fr) !important; gap: 10px !important; }
          .admin-shortcuts { grid-template-columns: repeat(4, 1fr) !important; }
        }

        @media (max-width: 767px) {
          main { padding: 12px 8px !important; }
          main h1 { font-size: 22px !important; }
          .admin-stats { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
          .admin-stats > div { padding: 12px 8px !important; }
          .admin-stats > div p:last-child { font-size: 22px !important; }
          .admin-filters select { min-width: 110px !important; font-size: 12px !important; }
          .admin-shortcuts { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .admin-shortcuts a { padding: 10px !important; font-size: 13px !important; }
          .admin-prop-row { flex-direction: column !important; gap: 8px !important; padding: 10px !important; }
          .admin-prop-row > a:first-child,
          .admin-prop-row > div:first-child { display: flex; gap: 10px; width: 100%; }
          .admin-prop-actions { flex-direction: row !important; width: 100% !important; justify-content: space-between !important; align-items: center !important; }
          .admin-prop-actions > div { display: flex; gap: 4px; }
        }
      ` }} />
    </main>
  );
}
