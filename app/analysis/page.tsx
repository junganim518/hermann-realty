'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window { kakao: any; daum: any; }
}

const KAKAO_KEY = '8a478b4b6ea5e02722a33f6ac2fa34b6';

const RADIUS_OPTIONS = [
  { value: 300, label: '300m' },
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
];

const BUSINESS_TYPES: Record<string, string[]> = {
  '음식': [
    '한식 (백반/국밥/찌개)',
    '한식 (구이/삼겹살)',
    '중식',
    '일식/초밥',
    '양식/패밀리레스토랑',
    '분식/김밥',
    '치킨',
    '피자/버거',
    '카페/디저트',
    '이자카야/주점',
    '샐러드/건강식',
    '베이커리',
    '국수/냉면',
    '해산물/횟집',
    '보쌈/족발',
  ],
  '소매': [
    '편의점',
    '슈퍼마켓',
    '반찬가게',
    '꽃집',
    '반려동물샵',
    '의류/잡화',
    '화장품',
    '생활용품',
  ],
  '서비스/미용': [
    '미용실',
    '네일샵',
    '피부관리',
    '필라테스/요가',
    '헬스장',
    '세탁소',
    '사진관',
    '인테리어',
  ],
  '의료': [
    '동물병원',
    '치과',
    '피부과',
    '한의원',
    '약국',
    '안과',
    '정형외과',
    '소아과',
  ],
  '교육': [
    '어린이집/유치원',
    '입시학원',
    '예체능학원',
    '영어유치원',
    '코딩학원',
    '독서실/스터디카페',
  ],
  '기타': [
    '부동산중개',
    '세무/법무사',
    '카센터',
    '공인중개사',
  ],
};

const GOLD = '#e2a06e';
const GOLD_LIGHT = '#fff8f2';
const GOLD_DARK = '#b8744a';

type SbizCategory = { name: string; count: number };
type SbizStore = { name: string; category: string; subCategory: string; detailCategory: string; address: string };
type SbizData = { total: number; categories: SbizCategory[]; topSubCategories: SbizCategory[]; stores: SbizStore[] };
type CompetitionLevel = '낮음' | '보통' | '높음';
type AiReport = {
  동선패턴: { 점심: string; 저녁: string; 주말: string };
  희소업종: { name: string; reason: string }[];
  경쟁현황: { name: string; level: CompetitionLevel }[];
  추천테이블: { 배후수요: string; 타겟: string; 상권특징: string; 추천업종: string }[];
};

// ─── 서브 컴포넌트 ───────────────────────────────────────────

function SectionCard({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="an-section-card" style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '14px', borderBottom: `2px solid ${GOLD}` }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{title}</h3>
        {right && <span style={{ fontSize: '14px', color: '#999' }}>{right}</span>}
      </div>
      {children}
    </div>
  );
}

function BarChart({ items, maxVal, color = GOLD }: { items: { label: string; count: number }[]; maxVal: number; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="an-bar-label" style={{ width: '88px', fontSize: '15px', color: '#555', flexShrink: 0, textAlign: 'right' }}>{item.label}</div>
          <div style={{ flex: 1, height: '12px', background: '#f0f0f0', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round((item.count / maxVal) * 100)}%`,
              height: '100%',
              background: color,
              borderRadius: '5px',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ width: '36px', fontSize: '15px', fontWeight: 700, color: '#333', textAlign: 'right', flexShrink: 0 }}>{item.count}</div>
        </div>
      ))}
    </div>
  );
}

function Top10Grid({ items }: { items: SbizCategory[] }) {
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="an-top10-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
      {items.map((c, i) => (
        <div key={c.name} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 12px',
          border: '1px solid #eee', borderRadius: '8px',
          background: i < 3 ? GOLD_LIGHT : '#fff',
        }}>
          <span style={{
            fontSize: '14px', fontWeight: 700,
            color: i < 3 ? GOLD_DARK : '#bbb',
            minWidth: '18px',
          }}>{i + 1}</span>
          <span style={{ fontSize: '15px', color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          <div style={{ width: '48px', height: '5px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: `${Math.round((c.count / max) * 100)}%`, height: '100%', background: GOLD, borderRadius: '3px' }} />
          </div>
          <span style={{ fontSize: '14px', color: '#999', minWidth: '28px', textAlign: 'right', flexShrink: 0 }}>{c.count}</span>
        </div>
      ))}
    </div>
  );
}

function StoreList({ stores }: { stores: SbizStore[] }) {
  const allCategories = Array.from(new Set(stores.map(s => s.category)));
  const [activeCategory, setActiveCategory] = useState('전체');
  const filtered = activeCategory === '전체' ? stores : stores.filter(s => s.category === activeCategory);

  return (
    <div>
      {/* 탭 필터 */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', marginBottom: '14px', overflowX: 'auto', paddingBottom: '6px', WebkitOverflowScrolling: 'touch' }}>
        {['전체', ...allCategories].map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '5px 14px',
              borderRadius: '999px',
              border: activeCategory === cat ? `1.5px solid ${GOLD}` : '1px solid #ddd',
              background: activeCategory === cat ? GOLD : '#fff',
              color: activeCategory === cat ? '#fff' : '#666',
              fontSize: '14px',
              fontWeight: activeCategory === cat ? 600 : 400,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {cat}
            {cat !== '전체' && (
              <span style={{ marginLeft: '4px', opacity: 0.8 }}>
                {stores.filter(s => s.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '440px', overflowY: 'auto', paddingRight: '4px' }}>
        {filtered.map((s, i) => (
          <div key={i} style={{ padding: '12px 14px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '3px' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>{s.name}</span>
              <span style={{ fontSize: '13px', color: '#fff', background: GOLD, padding: '2px 8px', borderRadius: '10px', flexShrink: 0, fontWeight: 600 }}>
                {s.category}
              </span>
            </div>
            <div style={{ fontSize: '14px', color: '#888', marginBottom: '2px' }}>
              {s.subCategory}{s.detailCategory && ` · ${s.detailCategory}`}
            </div>
            <div style={{ fontSize: '14px', color: '#aaa' }}>{s.address}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '8px', fontSize: '14px', color: '#bbb', textAlign: 'right' }}>
        {filtered.length}개 표시
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────

export default function AnalysisPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(500);
  const [sbiz, setSbiz] = useState<SbizData | null>(null);
  const [sbizLoading, setSbizLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [aiReport, setAiReport] = useState<AiReport | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('음식');
  const [selectedType, setSelectedType] = useState<string>('');

  useEffect(() => {
    if (window.kakao?.maps?.services) { initMap(); return; }
    const existing = document.getElementById('kakao-map-script');
    if (existing) existing.remove();
    const s = document.createElement('script');
    s.id = 'kakao-map-script';
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services&autoload=false`;
    s.async = true;
    s.onload = () => window.kakao.maps.load(initMap);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (document.getElementById('daum-postcode-script')) return;
    const s = document.createElement('script');
    s.id = 'daum-postcode-script';
    s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const center = new window.kakao.maps.LatLng(37.5040479677868, 126.77522691726);
    const map = new window.kakao.maps.Map(mapRef.current, { center, level: 5 });
    mapInstanceRef.current = map;
    setMapReady(true);
    setTimeout(() => { map.relayout(); map.setCenter(center); }, 100);
  };

  const searchAddress = () => {
    if (!window.daum?.Postcode) { alert('주소검색 스크립트를 불러오는 중입니다.'); return; }
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        const addr = data.roadAddress || data.jibunAddress;
        setAddress(addr);
        geocodeAndAnalyze(addr, radius);
      },
    }).open();
  };

  const geocodeAndAnalyze = (addr: string, r: number) => {
    if (!window.kakao?.maps?.services) { alert('지도 로딩 중입니다. 잠시 후 다시 시도해주세요.'); return; }
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(addr, (result: any[], status: string) => {
      if (status !== window.kakao.maps.services.Status.OK || !result[0]) { alert('주소를 찾을 수 없습니다.'); return; }
      const lat = parseFloat(result[0].y);
      const lng = parseFloat(result[0].x);
      setCoords({ lat, lng });
      drawMap(lat, lng, r);
      fetchSbiz(lat, lng, r, selectedType, addr);
    });
  };

  const fetchSbiz = async (lat: number, lng: number, r: number, businessType = '', addr?: string) => {
    setSbizLoading(true);
    setSbiz(null);
    setAiReport(null);
    setAiError(null);
    try {
      const res = await fetch(`/api/analysis?lat=${lat}&lng=${lng}&radius=${r}&businessType=${encodeURIComponent(businessType)}`);
      const data = await res.json();
      if (data.error) console.error('소상공인 API 오류:', data.error);
      else {
        setSbiz(data);
        if (data.total > 0) fetchAiReport(data, r, addr ?? address, businessType);
      }
    } catch (e) { console.error(e); }
    finally { setSbizLoading(false); }
  };

  const fetchAiReport = async (data: SbizData, r: number, addr: string, businessType = '') => {
    setAiLoading(true);
    setAiError(null);
    setAiReport(null);
    try {
      const res = await fetch('/api/analysis/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: data.categories,
          topSubCategories: data.topSubCategories,
          total: data.total,
          address: addr,
          radius: r,
          businessType,
        }),
      });
      const json = await res.json();
      if (json.error) {
        setAiError(json.error);
      } else if (json.report) {
        setAiReport(json.report);
      }
    } catch (e: any) {
      setAiError(e.message || 'AI 리포트 생성 실패');
    } finally {
      setAiLoading(false);
    }
  };

  const drawMap = (lat: number, lng: number, r: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const pos = new window.kakao.maps.LatLng(lat, lng);
    if (markerRef.current) markerRef.current.setMap(null);
    if (circleRef.current) circleRef.current.setMap(null);
    markerRef.current = new window.kakao.maps.Marker({ position: pos, map });
    circleRef.current = new window.kakao.maps.Circle({
      center: pos, radius: r,
      strokeWeight: 2, strokeColor: GOLD, strokeOpacity: 0.9, strokeStyle: 'solid',
      fillColor: GOLD, fillOpacity: 0.12,
    });
    circleRef.current.setMap(map);
    const level = r <= 300 ? 4 : r <= 500 ? 5 : 6;
    map.setLevel(level);
    map.setCenter(pos);
    setTimeout(() => { map.relayout(); map.setCenter(pos); }, 100);
  };

  const handleRadiusChange = (r: number) => {
    setRadius(r);
    if (coords) { drawMap(coords.lat, coords.lng, r); fetchSbiz(coords.lat, coords.lng, r, selectedType); }
  };

  const sbizMaxCount = sbiz ? Math.max(...sbiz.categories.map(c => c.count), 1) : 1;

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '32px 16px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          .an-title { font-size: 22px !important; }
          .an-kpi-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .an-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .an-radius-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .an-map { height: 260px !important; }
          .an-wrap { padding: 0 8px !important; }
          .an-top10-grid { grid-template-columns: 1fr !important; }
          .an-section-card { padding: 16px !important; }
          .an-addr-row { flex-direction: column !important; }
          .an-addr-row button { width: 100% !important; height: 44px !important; }
          .an-bar-label { width: 70px !important; font-size: 12px !important; }
          .an-pattern-grid { grid-template-columns: 1fr !important; }
          .an-section-card h3 { font-size: 16px !important; }
          .an-section-card p, .an-section-card span { font-size: 13px !important; }
        }
      ` }} />

      <div className="an-wrap" style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 className="an-title" style={{ fontSize: '32px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px' }}>AI 상권분석</h1>
          <p style={{ fontSize: '15px', color: '#888' }}>원하는 위치의 상권을 분석해드립니다</p>
        </div>

        {/* 주소 입력 */}
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '8px' }}>분석 위치</label>
          <div className="an-addr-row" style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
            <input
              value={address} readOnly placeholder="주소를 검색하세요"
              style={{ flex: 1, height: '46px', border: '1px solid #ddd', borderRadius: '8px', padding: '0 14px', fontSize: '15px', background: '#fafafa', color: '#333', outline: 'none' }}
            />
            <button type="button" onClick={searchAddress} style={{
              height: '46px', padding: '0 22px', background: GOLD, color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}>주소 검색</button>
          </div>

          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '8px' }}>분석 반경</label>
          <div className="an-radius-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {RADIUS_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => handleRadiusChange(opt.value)} style={{
                padding: '12px 0',
                border: radius === opt.value ? `2px solid ${GOLD}` : '1px solid #e0e0e0',
                background: radius === opt.value ? GOLD_LIGHT : '#fff',
                color: radius === opt.value ? GOLD_DARK : '#777',
                borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
                fontWeight: radius === opt.value ? 700 : 500, transition: 'all 0.15s',
              }}>{opt.label}</button>
            ))}
          </div>
        </div>

        {/* 창업 희망 업종 */}
        <div className="an-section-card" style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '12px' }}>창업 희망 업종</label>

          {/* 대분류 탭 */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {Object.keys(BUSINESS_TYPES).map(cat => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setSelectedCategory(cat); setSelectedType(''); }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '999px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    border: active ? `1px solid ${GOLD}` : '1px solid #ddd',
                    background: active ? GOLD : '#fff',
                    color: active ? '#fff' : '#666',
                    fontWeight: active ? 700 : 500,
                    transition: 'all 0.15s',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* 소분류 */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(BUSINESS_TYPES[selectedCategory] || []).map(type => {
              const active = selectedType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    border: active ? `1px solid ${GOLD}` : '1px solid #eee',
                    background: active ? GOLD_LIGHT : '#fff',
                    color: active ? GOLD_DARK : '#666',
                    fontWeight: active ? 700 : 500,
                    transition: 'all 0.15s',
                  }}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* 지도 */}
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
          <div ref={mapRef} className="an-map" style={{ width: '100%', height: '500px', background: '#eee' }} />
          {!coords && mapReady && (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#aaa', borderTop: '1px solid #f5f5f5' }}>
              주소를 검색하면 해당 위치 주변 상권을 분석합니다
            </div>
          )}
        </div>

        {/* ── AI 상권분석 리포트 ── */}
        {aiLoading && (
          <div style={{ background: '#fff', border: `2px solid ${GOLD}`, borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '18px' }}>🤖</span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: GOLD_DARK }}>AI 상권분석 리포트 생성 중...</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[80, 95, 70, 88].map((w, i) => (
                <div key={i} style={{ height: '14px', background: '#f0f0f0', borderRadius: '4px', width: `${w}%` }} />
              ))}
            </div>
          </div>
        )}

        {!aiLoading && aiError && (
          <div style={{ background: '#fff', border: '1px solid #f5d0d0', borderRadius: '12px', padding: '20px', marginBottom: '16px', fontSize: '13px', color: '#c44' }}>
            ⚠️ AI 리포트 생성 실패: {aiError}
          </div>
        )}

        {!aiLoading && aiReport && (
          <SectionCard title="🤖 AI 상권분석 리포트" right="Claude Sonnet 4">
            {selectedType && (
              <div style={{
                display: 'inline-block',
                padding: '8px 16px',
                background: GOLD,
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                borderRadius: '999px',
                marginBottom: '20px',
              }}>
                📍 [{selectedType}] 창업 관점 분석
              </div>
            )}

            {/* ① 동선 패턴 분석 */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', marginBottom: '12px' }}>
                <span style={{ display: 'inline-block', width: '22px', height: '22px', lineHeight: '22px', textAlign: 'center', borderRadius: '50%', background: GOLD, color: '#fff', fontSize: '11px', marginRight: '8px' }}>1</span>
                동선 패턴 분석
              </h4>
              <div className="an-pattern-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { label: '점심', text: aiReport.동선패턴.점심, icon: '🌞' },
                  { label: '저녁', text: aiReport.동선패턴.저녁, icon: '🌙' },
                  { label: '주말', text: aiReport.동선패턴.주말, icon: '📅' },
                ].map(it => (
                  <div key={it.label} style={{ padding: '14px', background: GOLD_LIGHT, borderRadius: '8px', border: '1px solid #fbe5d3' }}>
                    <div style={{ fontSize: '14px', color: GOLD_DARK, fontWeight: 700, marginBottom: '6px' }}>{it.icon} {it.label}</div>
                    <div style={{ fontSize: '15px', color: '#444', lineHeight: 1.5 }}>{it.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ② 희소 업종 제안 */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', marginBottom: '12px' }}>
                <span style={{ display: 'inline-block', width: '22px', height: '22px', lineHeight: '22px', textAlign: 'center', borderRadius: '50%', background: GOLD, color: '#fff', fontSize: '11px', marginRight: '8px' }}>2</span>
                희소 업종 제안
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {aiReport.희소업종.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: '8px' }}>
                    <span style={{ display: 'inline-block', padding: '4px 12px', background: GOLD, color: '#fff', fontSize: '14px', fontWeight: 700, borderRadius: '999px', flexShrink: 0 }}>{item.name}</span>
                    <span style={{ fontSize: '15px', color: '#666', lineHeight: 1.5 }}>{item.reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ③ 경쟁 현황 요약 */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', marginBottom: '12px' }}>
                <span style={{ display: 'inline-block', width: '22px', height: '22px', lineHeight: '22px', textAlign: 'center', borderRadius: '50%', background: GOLD, color: '#fff', fontSize: '11px', marginRight: '8px' }}>3</span>
                경쟁 현황 요약
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {aiReport.경쟁현황.map((item, i) => {
                  const colors: Record<CompetitionLevel, { bg: string; fg: string; bar: string; w: number }> = {
                    '낮음': { bg: '#e8f5e9', fg: '#2e7d32', bar: '#66bb6a', w: 33 },
                    '보통': { bg: '#fff8e1', fg: '#a06400', bar: '#ffb300', w: 66 },
                    '높음': { bg: '#fdecea', fg: '#c62828', bar: '#ef5350', w: 100 },
                  };
                  const c = colors[item.level] || colors['보통'];
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '110px', fontSize: '15px', color: '#444', flexShrink: 0 }}>{item.name}</div>
                      <div style={{ flex: 1, height: '11px', background: '#f0f0f0', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ width: `${c.w}%`, height: '100%', background: c.bar, borderRadius: '6px', transition: 'width 0.5s' }} />
                      </div>
                      <span style={{ padding: '3px 10px', background: c.bg, color: c.fg, fontSize: '14px', fontWeight: 700, borderRadius: '999px', minWidth: '46px', textAlign: 'center', flexShrink: 0 }}>{item.level}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ④ 추천 업종 테이블 */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', marginBottom: '12px' }}>
                <span style={{ display: 'inline-block', width: '22px', height: '22px', lineHeight: '22px', textAlign: 'center', borderRadius: '50%', background: GOLD, color: '#fff', fontSize: '11px', marginRight: '8px' }}>4</span>
                추천 업종
              </h4>
              <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', minWidth: '560px' }}>
                  <thead>
                    <tr style={{ background: GOLD_LIGHT }}>
                      <th style={{ padding: '12px 14px', textAlign: 'left', color: GOLD_DARK, fontWeight: 700, borderBottom: `2px solid ${GOLD}` }}>배후수요</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', color: GOLD_DARK, fontWeight: 700, borderBottom: `2px solid ${GOLD}` }}>주 타겟</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', color: GOLD_DARK, fontWeight: 700, borderBottom: `2px solid ${GOLD}` }}>상권 특징</th>
                      <th style={{ padding: '12px 14px', textAlign: 'left', color: GOLD_DARK, fontWeight: 700, borderBottom: `2px solid ${GOLD}` }}>추천 업종</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiReport.추천테이블.map((row, i) => (
                      <tr key={i} style={{ borderBottom: i === aiReport.추천테이블.length - 1 ? 'none' : '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px 14px', color: '#555' }}>{row.배후수요}</td>
                        <td style={{ padding: '12px 14px', color: '#555' }}>{row.타겟}</td>
                        <td style={{ padding: '12px 14px', color: '#555' }}>{row.상권특징}</td>
                        <td style={{ padding: '12px 14px', color: GOLD_DARK, fontWeight: 700 }}>{row.추천업종}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── 소상공인 섹션 ── */}
        {sbizLoading && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '40px', textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>📊</div>
            <div style={{ fontSize: '14px', color: '#888' }}>소상공인 상권 데이터를 불러오는 중...</div>
          </div>
        )}

        {!sbizLoading && sbiz && sbiz.total > 0 && (
          <>
            {/* 업종 대분류 차트 */}
            <SectionCard title="소상공인 상권정보" right={`총 점포 ${sbiz.total.toLocaleString()}개`}>
              <p style={{ fontSize: '14px', color: '#bbb', marginBottom: '16px' }}>
                소상공인시장진흥공단 상권정보시스템 기반 등록 점포 데이터
              </p>
              <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#888', marginBottom: '12px' }}>업종 대분류별 점포 수</h4>
              <BarChart
                items={sbiz.categories.map(c => ({ label: c.name, count: c.count }))}
                maxVal={sbizMaxCount}
              />
            </SectionCard>

            {/* TOP 10 — 2열 그리드 */}
            {sbiz.topSubCategories.length > 0 && (
              <SectionCard title="주요 업종 TOP 10">
                <Top10Grid items={sbiz.topSubCategories} />
              </SectionCard>
            )}

            {/* 점포 목록 — 탭 필터 */}
            {sbiz.stores.length > 0 && (
              <SectionCard title="점포 목록" right={`${sbiz.stores.length}개`}>
                <StoreList stores={sbiz.stores} />
              </SectionCard>
            )}
          </>
        )}

        {!sbizLoading && sbiz && sbiz.total === 0 && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '40px', textAlign: 'center', fontSize: '14px', color: '#aaa' }}>
            소상공인 상권정보에서 등록된 점포 데이터를 찾지 못했습니다.
          </div>
        )}

      </div>
    </main>
  );
}