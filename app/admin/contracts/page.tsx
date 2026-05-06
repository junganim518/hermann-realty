'use client';

import { useEffect, useState, useMemo, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  effectiveStatus,
  getStatusColors,
  getDDayInfo,
  formatContractPrice,
  formatPeriod,
  isExpiringSoon,
  CONTRACT_TYPES,
  type ContractType,
  type ContractStatus,
} from '@/lib/contracts';

export default function ContractsPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</main>}>
      <ContractsInner />
    </Suspense>
  );
}

function ContractsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const readParam = (key: string, fallback: string) => searchParams.get(key) || fallback;

  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<any[]>([]);
  const [propertyMap, setPropertyMap] = useState<Record<string, any>>({});
  const [landlordMap, setLandlordMap] = useState<Record<string, any>>({});

  const [filterStatus, setFilterStatus] = useState(readParam('status', '전체'));
  const [filterType, setFilterType] = useState(readParam('type', '전체'));
  const [search, setSearch] = useState(readParam('q', ''));
  const [sortBy, setSortBy] = useState<'expiring' | 'contract_date' | 'created_at'>((readParam('sort', 'expiring') as any));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/contracts'); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      const { data: cs } = await supabase.from('contracts').select('*').order('created_at', { ascending: false });
      setContracts(cs ?? []);
      const propIds = Array.from(new Set((cs ?? []).map(c => c.property_id).filter(Boolean)));
      const landlordIds = Array.from(new Set((cs ?? []).map(c => c.landlord_id).filter(Boolean)));
      if (propIds.length > 0) {
        const { data: props } = await supabase.from('properties').select('id, property_number, address, building_name').in('id', propIds);
        const map: Record<string, any> = {}; (props ?? []).forEach(p => { map[p.id] = p; }); setPropertyMap(map);
      }
      if (landlordIds.length > 0) {
        const { data: lands } = await supabase.from('landlords').select('id, name').in('id', landlordIds);
        const map: Record<string, any> = {}; (lands ?? []).forEach(l => { map[l.id] = l; }); setLandlordMap(map);
      }
      setLoading(false);
    })();
  }, [authChecked]);

  const syncURL = useCallback((overrides: Record<string, string> = {}) => {
    const vals: Record<string, string> = { status: filterStatus, type: filterType, q: search, sort: sortBy, ...overrides };
    const defaults: Record<string, string> = { status: '전체', type: '전체', q: '', sort: 'expiring' };
    const params = new URLSearchParams();
    Object.entries(vals).forEach(([k, v]) => { if (v && defaults[k] !== v) params.set(k, v); });
    const qs = params.toString();
    router.replace(`/admin/contracts${qs ? '?' + qs : ''}`, { scroll: false });
  }, [filterStatus, filterType, search, sortBy, router]);

  // 통계
  const stats = useMemo(() => {
    let active = 0, expiring = 0, ended = 0;
    for (const c of contracts) {
      const eff = effectiveStatus(c) as ContractStatus;
      if (eff === '종료' || eff === '재계약') ended++;
      else active++;
      if (isExpiringSoon(c)) expiring++;
    }
    return { total: contracts.length, active, expiring, ended };
  }, [contracts]);

  // 필터 + 정렬
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = contracts.filter(c => {
      const eff = effectiveStatus(c) as ContractStatus;
      if (filterStatus !== '전체' && eff !== filterStatus) return false;
      if (filterType !== '전체' && c.contract_type !== filterType) return false;
      if (q) {
        const prop = c.property_id ? propertyMap[c.property_id] : null;
        const landlord = c.landlord_id ? landlordMap[c.landlord_id] : null;
        const hay = `${prop?.property_number ?? ''} ${prop?.address ?? ''} ${prop?.building_name ?? ''} ${landlord?.name ?? ''} ${c.tenant_name ?? ''} ${c.tenant_business_name ?? ''} ${c.tenant_phone ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'expiring') {
      // 임대 계약 만기 임박순(D-Day asc, 매매/만기지남은 뒤), 동률은 created_at desc
      list = [...list].sort((a, b) => {
        const aIsRent = a.contract_type !== '매매';
        const bIsRent = b.contract_type !== '매매';
        if (aIsRent !== bIsRent) return aIsRent ? -1 : 1;
        const aDD = a.end_date ? Math.round((new Date(a.end_date).getTime() - Date.now()) / 86400000) : 9999;
        const bDD = b.end_date ? Math.round((new Date(b.end_date).getTime() - Date.now()) / 86400000) : 9999;
        // 만기 안 지난 것 우선, 그중 가까운 순
        const aFuture = aDD >= 0 ? 0 : 1;
        const bFuture = bDD >= 0 ? 0 : 1;
        if (aFuture !== bFuture) return aFuture - bFuture;
        return aDD - bDD;
      });
    } else if (sortBy === 'contract_date') {
      list = [...list].sort((a, b) => {
        const aDate = a.contract_date ?? a.created_at;
        const bDate = b.contract_date ?? b.created_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
    }
    // 기본 created_at desc는 이미 fetch 시 적용됨
    return list;
  }, [contracts, filterStatus, filterType, search, sortBy, propertyMap, landlordMap]);

  if (!authChecked || loading) return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</main>;

  const cardSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', textAlign: 'center' };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px 16px 60px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          .c-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      ` }} />

      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => router.push('/admin')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
              <ArrowLeft size={14} /> 대시보드
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>📋 계약 관리</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/admin/landlords" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 14px', background: '#fff', color: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '6px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              👥 임대인
            </Link>
            <Link href="/admin/contracts/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '8px 14px', background: '#e2a06e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              <Plus size={14} /> 새 계약
            </Link>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="c-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={cardSt}>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>전체</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#1a1a1a' }}>{stats.total}</p>
          </div>
          <div style={cardSt}>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>진행중</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#075985' }}>{stats.active}</p>
          </div>
          <div style={{ ...cardSt, background: stats.expiring > 0 ? '#fef9c3' : '#fff', borderColor: stats.expiring > 0 ? '#fcd34d' : '#e0e0e0' }}>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>만기 임박</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: stats.expiring > 0 ? '#92400e' : '#888' }}>{stats.expiring}</p>
          </div>
          <div style={cardSt}>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>종료/재계약</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#888' }}>{stats.ended}</p>
          </div>
        </div>

        {/* 필터 + 검색 + 정렬 */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); syncURL({ q: e.target.value }); }}
              placeholder="매물번호 / 주소 / 임대인·임차인 / 상호명"
              style={{ flex: 1, minWidth: '200px', height: '36px', padding: '0 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
            />
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value as any); syncURL({ sort: e.target.value }); }}
              style={{ height: '36px', padding: '0 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: '#fff' }}
            >
              <option value="expiring">만기 임박순</option>
              <option value="contract_date">계약일순</option>
              <option value="created_at">등록순</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {/* 상태 필터 */}
            {['전체', '진행중', '입주완료', '만기임박', '만기', '종료'].map(s => {
              const active = filterStatus === s;
              return (
                <button key={s} type="button"
                  onClick={() => { setFilterStatus(s); syncURL({ status: s }); }}
                  style={{ padding: '5px 12px', fontSize: '12px', fontWeight: active ? 700 : 500, borderRadius: '999px',
                    background: active ? '#1a1a1a' : '#fff', color: active ? '#e2a06e' : '#666',
                    border: active ? '1px solid #1a1a1a' : '1px solid #ddd', cursor: active ? 'default' : 'pointer' }}
                >{s}</button>
              );
            })}
            <span style={{ color: '#ddd', alignSelf: 'center' }}>|</span>
            {/* 종류 필터 */}
            {(['전체', ...CONTRACT_TYPES] as const).map(t => {
              const active = filterType === t;
              return (
                <button key={t} type="button"
                  onClick={() => { setFilterType(t); syncURL({ type: t }); }}
                  style={{ padding: '5px 12px', fontSize: '12px', fontWeight: active ? 700 : 500, borderRadius: '999px',
                    background: active ? '#e2a06e' : '#fff', color: active ? '#fff' : '#666',
                    border: active ? '1px solid #e2a06e' : '1px solid #ddd', cursor: active ? 'default' : 'pointer' }}
                >{t}</button>
              );
            })}
          </div>
        </div>

        {/* 계약 목록 */}
        {filtered.length === 0 ? (
          <div style={{ ...cardSt, padding: '60px 0' }}>
            <p style={{ fontSize: '14px', color: '#888', marginBottom: '12px' }}>{contracts.length === 0 ? '등록된 계약이 없습니다' : '조건에 맞는 계약이 없습니다'}</p>
            {contracts.length === 0 && (
              <Link href="/admin/contracts/new" style={{ display: 'inline-block', padding: '10px 20px', background: '#e2a06e', color: '#fff', borderRadius: '6px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
                + 첫 계약 등록하기
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(c => {
              const eff = effectiveStatus(c) as ContractStatus;
              const colors = getStatusColors(eff);
              const dInfo = getDDayInfo(c.end_date, c.contract_type as ContractType);
              const prop = c.property_id ? propertyMap[c.property_id] : null;
              const landlord = c.landlord_id ? landlordMap[c.landlord_id] : null;
              return (
                <Link key={c.id} href={`/admin/contracts/${c.id}`} style={{ display: 'block', padding: '14px 16px', background: '#fff', border: `1px solid ${dInfo.urgency === 'critical' || dInfo.urgency === 'urgent' ? '#fed7aa' : '#e0e0e0'}`, borderRadius: '8px', textDecoration: 'none', color: '#1a1a1a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>{eff}</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#f5f5f5', color: '#666' }}>{c.contract_type}</span>
                        {prop && <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>{prop.property_number}</span>}
                        {dInfo.urgency !== 'na' && (
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: dInfo.bg, color: dInfo.color }}>{dInfo.label}</span>
                        )}
                      </div>
                      <p style={{ fontSize: '13px', color: '#555', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prop ? `${prop.address}${prop.building_name ? ` · ${prop.building_name}` : ''}` : '(매물 미연결)'}
                      </p>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#666', flexWrap: 'wrap' }}>
                        <span>임대 {landlord?.name ?? '-'}</span>
                        <span>·</span>
                        <span>임차 {c.tenant_name ?? '-'}{c.tenant_business_name ? ` (${c.tenant_business_name})` : ''}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#888', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span>{formatPeriod(c.start_date, c.end_date)}</span>
                        <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{formatContractPrice(c)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
