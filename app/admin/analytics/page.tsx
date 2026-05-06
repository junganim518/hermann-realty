'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Smartphone, Monitor } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type PageView,
  groupByDate,
  groupByHourAndDay,
  toMatrixWeek,
  groupByDevice,
  groupByReferrer,
  groupByPage,
} from '@/lib/analyticsUtils';

const GOLD = '#e2a06e';
const BLACK = '#1a1a1a';

// 유입 경로별 색상
const REF_COLORS: Record<string, string> = {
  '직접접속': '#94a3b8',
  '네이버': '#03c75a',
  '구글': '#4285f4',
  '카카오': '#fee500',
  '다음': '#0066ff',
  '기타': '#cbd5e1',
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [allViews, setAllViews] = useState<PageView[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [weekCount, setWeekCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [propertyMap, setPropertyMap] = useState<Record<string, { property_number: string; address: string }>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/analytics'); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      setLoading(true);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(); monthStart.setDate(monthStart.getDate() - 29); monthStart.setHours(0, 0, 0, 0);

      const [todayRes, weekRes, monthRes, totalRes] = await Promise.all([
        supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
        supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
        supabase.from('page_views').select('*', { count: 'exact', head: true }),
      ]);
      setTodayCount(todayRes.count ?? 0);
      setWeekCount(weekRes.count ?? 0);
      setMonthCount(monthRes.count ?? 0);
      setTotalCount(totalRes.count ?? 0);

      // 차트용 raw 데이터 — 최대 90일 fetch (히트맵/도넛/파이는 동일 기간 사용)
      const periodStart = new Date(); periodStart.setDate(periodStart.getDate() - 89); periodStart.setHours(0, 0, 0, 0);
      const { data: views } = await supabase
        .from('page_views')
        .select('created_at, page, device, referrer')
        .gte('created_at', periodStart.toISOString())
        .order('created_at', { ascending: true });
      setAllViews((views as PageView[]) ?? []);

      // /item/view/{pnum} 페이지를 매물 정보로 매핑하기 위한 fetch
      const pnumSet = new Set<string>();
      for (const v of (views ?? [])) {
        const m = (v.page ?? '').match(/^\/item\/view\/(.+)$/);
        if (m && m[1]) pnumSet.add(decodeURIComponent(m[1]));
      }
      if (pnumSet.size > 0) {
        const { data: props } = await supabase
          .from('properties')
          .select('property_number, address')
          .in('property_number', Array.from(pnumSet));
        const map: Record<string, { property_number: string; address: string }> = {};
        (props ?? []).forEach(p => { map[String(p.property_number)] = { property_number: String(p.property_number), address: p.address ?? '' }; });
        setPropertyMap(map);
      }

      setLoading(false);
    })();
  }, [authChecked]);

  // days에 따라 필터된 데이터
  const filteredViews = useMemo(() => {
    if (allViews.length === 0) return [];
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - (days - 1)); cutoff.setHours(0, 0, 0, 0);
    return allViews.filter(v => new Date(v.created_at).getTime() >= cutoff.getTime());
  }, [allViews, days]);

  const dailySeries = useMemo(() => groupByDate(filteredViews, days), [filteredViews, days]);
  const heatmap = useMemo(() => toMatrixWeek(groupByHourAndDay(filteredViews)), [filteredViews]);
  const deviceCounts = useMemo(() => groupByDevice(filteredViews), [filteredViews]);
  const referrerCounts = useMemo(() => groupByReferrer(filteredViews), [filteredViews]);
  const topPages = useMemo(() => groupByPage(filteredViews, 10), [filteredViews]);

  const renderPageLabel = (page: string): { label: string; href: string } => {
    const m = page.match(/^\/item\/view\/(.+)$/);
    if (m && m[1]) {
      const pnum = decodeURIComponent(m[1]);
      const prop = propertyMap[pnum];
      const shortAddr = prop?.address ? prop.address.split(' ').slice(-2).join(' ') : '';
      return { label: `${pnum}${shortAddr ? ` · ${shortAddr}` : ''}`, href: page };
    }
    if (page === '/') return { label: '메인 페이지', href: '/' };
    if (page === '/properties') return { label: '전체매물', href: page };
    if (page === '/map') return { label: '지도검색', href: page };
    if (page === '/recent') return { label: '최근 본 매물', href: page };
    if (page === '/about') return { label: '회사 소개', href: page };
    if (page === '/news') return { label: '소식', href: page };
    return { label: page, href: page };
  };

  if (!authChecked || loading) {
    return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</main>;
  }

  const cardSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', textAlign: 'center' };
  const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '24px', marginBottom: '20px' };
  const sectionTitleSt: React.CSSProperties = { fontSize: '18px', fontWeight: 700, color: BLACK, marginBottom: '16px', paddingBottom: '10px', borderBottom: `2px solid ${GOLD}` };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px 16px 60px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          .a-summary { grid-template-columns: repeat(2, 1fr) !important; }
          .a-row2 { grid-template-columns: 1fr !important; }
          .a-heatmap-wrap { overflow-x: auto !important; }
          .a-heatmap { min-width: 580px !important; }
        }
      ` }} />

      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.push('/admin')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
              <ArrowLeft size={14} /> 대시보드로
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: BLACK, margin: 0 }}>📊 방문자 통계</h1>
          </div>
          <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid #ddd' }}>
            {([7, 30, 90] as const).map(d => {
              const active = days === d;
              return (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  style={{
                    padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                    background: active ? BLACK : '#fff',
                    color: active ? GOLD : '#666',
                    border: 'none', cursor: active ? 'default' : 'pointer',
                  }}
                >최근 {d}일</button>
              );
            })}
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="a-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={cardSt}>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>오늘 방문자</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: BLACK }}>{todayCount.toLocaleString()}</p>
          </div>
          <div style={cardSt}>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>최근 7일</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: BLACK }}>{weekCount.toLocaleString()}</p>
          </div>
          <div style={cardSt}>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>최근 30일</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: BLACK }}>{monthCount.toLocaleString()}</p>
          </div>
          <div style={cardSt}>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>전체 누적</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: GOLD }}>{totalCount.toLocaleString()}</p>
          </div>
        </div>

        {/* 일자별 추세 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>일자별 방문자 추세</h2>
          <LineChart series={dailySeries} />
        </div>

        {/* 시간대별 히트맵 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>시간대별 히트맵 <span style={{ fontSize: '12px', fontWeight: 500, color: '#888' }}>(요일 × 시간)</span></h2>
          <div className="a-heatmap-wrap">
            <Heatmap rows={heatmap.rows} labels={heatmap.labels} />
          </div>
        </div>

        {/* 디바이스 + 유입 경로 */}
        <div className="a-row2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div style={sectionSt}>
            <h2 style={sectionTitleSt}>디바이스 분포</h2>
            <DeviceDonut counts={deviceCounts} />
          </div>
          <div style={sectionSt}>
            <h2 style={sectionTitleSt}>유입 경로</h2>
            <ReferrerPie items={referrerCounts} />
          </div>
        </div>

        {/* TOP 10 페이지 */}
        <div style={sectionSt}>
          <h2 style={sectionTitleSt}>인기 페이지 TOP 10</h2>
          {topPages.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa', padding: '20px 0', fontSize: '13px' }}>방문 데이터가 없습니다</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2a06e' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '12px', color: '#888', fontWeight: 600, width: '50px' }}>#</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '12px', color: '#888', fontWeight: 600 }}>페이지</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: '12px', color: '#888', fontWeight: 600, width: '80px' }}>조회수</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: '12px', color: '#888', fontWeight: 600, width: '80px' }}>비율</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const totalForPct = topPages.reduce((s, x) => s + x.count, 0);
                  return topPages.map((row, i) => {
                    const { label, href } = renderPageLabel(row.page);
                    const pct = totalForPct > 0 ? (row.count / totalForPct) * 100 : 0;
                    return (
                      <tr key={row.page} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 8px', color: '#888', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <a href={href} target="_blank" rel="noreferrer" style={{ color: BLACK, textDecoration: 'none', fontWeight: 500 }}>{label}</a>
                          <span style={{ marginLeft: '8px', color: '#bbb', fontSize: '11px' }}>{row.page}</span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: GOLD }}>{row.count.toLocaleString()}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', color: '#666' }}>{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </main>
  );
}

/* ════════════ 차트 컴포넌트 (자체 SVG 구현) ════════════ */

function LineChart({ series }: { series: Array<{ date: string; count: number; label: string }> }) {
  const W = 1000, H = 240, P = 36;
  const max = Math.max(1, ...series.map(s => s.count));
  if (series.length === 0) return <p style={{ textAlign: 'center', color: '#aaa', padding: '20px 0' }}>데이터 없음</p>;
  const xStep = (W - P * 2) / Math.max(1, series.length - 1);
  const points = series.map((s, i) => ({
    x: P + i * xStep,
    y: H - P - (s.count / max) * (H - P * 2),
    ...s,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${H - P} L ${points[0].x} ${H - P} Z`;
  // x축 라벨 — 너무 빽빽하지 않게 간격 자동 조정
  const labelStep = Math.max(1, Math.ceil(series.length / 10));

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: 'block', minWidth: '600px' }}>
        {/* 그리드 라인 */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = H - P - t * (H - P * 2);
          return <line key={t} x1={P} y1={y} x2={W - P} y2={y} stroke="#f0f0f0" strokeWidth="1" />;
        })}
        {/* 영역 채움 */}
        <path d={areaD} fill={GOLD} fillOpacity="0.12" />
        {/* 라인 */}
        <path d={pathD} fill="none" stroke={GOLD} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* 포인트 */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill={GOLD} />
            <title>{p.label} · {p.count.toLocaleString()}명</title>
          </g>
        ))}
        {/* x축 라벨 */}
        {points.map((p, i) => (
          (i % labelStep === 0 || i === points.length - 1) && (
            <text key={i} x={p.x} y={H - 8} fontSize="10" fill="#888" textAnchor="middle">{p.label}</text>
          )
        ))}
        {/* y축 max 라벨 */}
        <text x={P - 4} y={P + 4} fontSize="10" fill="#888" textAnchor="end">{max}</text>
        <text x={P - 4} y={H - P} fontSize="10" fill="#888" textAnchor="end">0</text>
      </svg>
    </div>
  );
}

function Heatmap({ rows, labels }: { rows: number[][]; labels: string[] }) {
  const max = Math.max(1, ...rows.flat());
  const cellSize = 22;
  return (
    <div className="a-heatmap" style={{ display: 'inline-block' }}>
      {/* 시간 라벨 (위) */}
      <div style={{ display: 'grid', gridTemplateColumns: `36px repeat(24, ${cellSize}px)`, gap: '2px', marginBottom: '4px' }}>
        <div></div>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ fontSize: '9px', color: '#888', textAlign: 'center' }}>
            {h % 3 === 0 ? h : ''}
          </div>
        ))}
      </div>
      {/* 요일별 행 */}
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: `36px repeat(24, ${cellSize}px)`, gap: '2px', marginBottom: '2px' }}>
          <div style={{ fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px', fontWeight: 600 }}>{labels[ri]}</div>
          {row.map((v, ci) => {
            const intensity = v === 0 ? 0 : v / max;
            const bg = v === 0 ? '#f5f5f5' : `rgba(226, 160, 110, ${0.15 + intensity * 0.85})`;
            return (
              <div
                key={ci}
                title={`${labels[ri]}요일 ${ci}시 · ${v.toLocaleString()}명`}
                style={{
                  width: `${cellSize}px`, height: `${cellSize}px`,
                  background: bg,
                  borderRadius: '3px',
                  cursor: 'default',
                }}
              />
            );
          })}
        </div>
      ))}
      {/* 범례 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '10px', color: '#888' }}>
        <span>적음</span>
        {[0.2, 0.4, 0.6, 0.8, 1].map(t => (
          <div key={t} style={{ width: '14px', height: '14px', borderRadius: '2px', background: `rgba(226, 160, 110, ${0.15 + t * 0.85})` }} />
        ))}
        <span>많음</span>
      </div>
    </div>
  );
}

function DeviceDonut({ counts }: { counts: { mobile: number; pc: number; unknown: number } }) {
  const total = counts.mobile + counts.pc + counts.unknown;
  if (total === 0) return <p style={{ textAlign: 'center', color: '#aaa', padding: '20px 0', fontSize: '13px' }}>데이터 없음</p>;
  const r = 70, cx = 100, cy = 100, sw = 28;
  const circumference = 2 * Math.PI * r;
  const segments = [
    { key: '모바일', value: counts.mobile, color: GOLD },
    { key: 'PC', value: counts.pc, color: '#3b3b3b' },
    ...(counts.unknown > 0 ? [{ key: '기타', value: counts.unknown, color: '#cbd5e1' }] : []),
  ];
  let offset = 0;
  const mobilePct = (counts.mobile / total) * 100;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circumference;
          const dashArray = `${dash} ${circumference - dash}`;
          const dashOffset = -offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="transparent"
              stroke={seg.color}
              strokeWidth={sw}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
        })}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="13" fill="#888">총 방문</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="20" fontWeight="700" fill={BLACK}>{total.toLocaleString()}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Smartphone size={16} color={GOLD} />
          <span style={{ color: '#666' }}>모바일</span>
          <strong style={{ color: GOLD }}>{counts.mobile.toLocaleString()}</strong>
          <span style={{ color: '#888', fontSize: '11px' }}>{mobilePct.toFixed(1)}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Monitor size={16} color="#3b3b3b" />
          <span style={{ color: '#666' }}>PC</span>
          <strong style={{ color: BLACK }}>{counts.pc.toLocaleString()}</strong>
          <span style={{ color: '#888', fontSize: '11px' }}>{((counts.pc / total) * 100).toFixed(1)}%</span>
        </div>
        {counts.unknown > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#cbd5e1', display: 'inline-block' }} />
            <span style={{ color: '#666' }}>기타</span>
            <strong style={{ color: '#888' }}>{counts.unknown.toLocaleString()}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

function ReferrerPie({ items }: { items: Array<{ label: string; count: number }> }) {
  const total = items.reduce((s, x) => s + x.count, 0);
  if (total === 0) return <p style={{ textAlign: 'center', color: '#aaa', padding: '20px 0', fontSize: '13px' }}>데이터 없음</p>;
  const r = 80, cx = 100, cy = 100;
  let cumAngle = -Math.PI / 2; // 12시 방향부터 시작
  const slices = items.map(item => {
    const angle = (item.count / total) * Math.PI * 2;
    const startAngle = cumAngle;
    const endAngle = cumAngle + angle;
    cumAngle = endAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { ...item, d, color: REF_COLORS[item.label] ?? '#999' };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth="2">
            <title>{s.label} · {s.count.toLocaleString()}회 ({((s.count / total) * 100).toFixed(1)}%)</title>
          </path>
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', minWidth: '140px' }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '2px', background: s.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: '#666', flex: 1 }}>{s.label}</span>
            <strong style={{ color: BLACK }}>{s.count.toLocaleString()}</strong>
            <span style={{ color: '#888', fontSize: '11px', minWidth: '42px', textAlign: 'right' }}>{((s.count / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
