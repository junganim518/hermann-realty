'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

declare global { interface Window { kakao: any; } }

const KAKAO_KEY = '8a478b4b6ea5e02722a33f6ac2fa34b6';

const CHECKLIST_KEYS = [
  '층수 확인', '전용면적 확인', '권리금 유무', '화장실 확인',
  '주차 가능 여부', '엘리베이터 유무', '현재 임차 여부', '관리비 확인', '입주 가능일',
];

type Agent = { id: string; name: string; title?: string; };
type FieldTrip = {
  id: string; title: string; trip_date: string;
  agent_id: string | null; status: 'planned' | 'completed'; created_at: string;
};
type FieldTripItem = {
  id: string; field_trip_id: string; property_id: string | null;
  address: string; building_name: string | null; order_num: number;
  status: 'planned' | 'completed'; memo: string | null;
  checklist: Record<string, boolean> | null;
  latitude: number | null; longitude: number | null; created_at: string;
};
type PropOption = {
  id: string; property_number: string; address: string;
  building_name: string | null; title: string | null;
  latitude: number | null; longitude: number | null;
};

const inputSt: React.CSSProperties = {
  width: '100%', height: '42px', border: '1px solid #ddd', borderRadius: '6px',
  padding: '0 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};

export default function FieldTripsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<'planned' | 'completed'>('planned');
  const [trips, setTrips] = useState<FieldTrip[]>([]);
  const [itemsByTrip, setItemsByTrip] = useState<Record<string, FieldTripItem[]>>({});
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [propOptions, setPropOptions] = useState<PropOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Map
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Add trip form
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [tripForm, setTripForm] = useState({
    title: '', trip_date: new Date().toISOString().slice(0, 10), agent_id: '',
  });
  const [savingTrip, setSavingTrip] = useState(false);

  // Add item form
  const [addItemFor, setAddItemFor] = useState<string | null>(null);
  const [itemMode, setItemMode] = useState<'property' | 'manual'>('property');
  const [propSearch, setPropSearch] = useState('');
  const [selectedPropId, setSelectedPropId] = useState('');
  const [itemForm, setItemForm] = useState({ address: '', building_name: '' });
  const [savingItem, setSavingItem] = useState(false);

  // Detail modal (memo + checklist)
  const [detailItem, setDetailItem] = useState<FieldTripItem | null>(null);
  const [detailMemo, setDetailMemo] = useState('');
  const [detailChecklist, setDetailChecklist] = useState<Record<string, boolean>>({});
  const [savingDetail, setSavingDetail] = useState(false);

  // Completed items
  const [completedItems, setCompletedItems] = useState<(FieldTripItem & { trip_title: string })[]>([]);

  // Toast
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/field-trips'); return; }
      setAuthChecked(true);
    });
  }, []);

  // Load data
  useEffect(() => {
    if (!authChecked) return;
    loadAll();
  }, [authChecked]);

  const loadAll = async () => {
    setLoading(true);
    const [tripsRes, agentsRes, propsRes] = await Promise.all([
      supabase.from('field_trips').select('*').order('trip_date', { ascending: true }),
      supabase.from('agents').select('id, name, title').eq('is_active', true),
      supabase.from('properties')
        .select('id, property_number, address, building_name, title, latitude, longitude')
        .is('deleted_at', null)
        .order('property_number', { ascending: false })
        .limit(500),
    ]);

    const allTrips: FieldTrip[] = tripsRes.data ?? [];
    setTrips(allTrips);
    setAgents(agentsRes.data ?? []);
    setPropOptions(propsRes.data ?? []);

    if (allTrips.length > 0) {
      const tripIds = allTrips.map(t => t.id);
      const { data: items } = await supabase
        .from('field_trip_items').select('*')
        .in('field_trip_id', tripIds)
        .order('order_num', { ascending: true });

      const byTrip: Record<string, FieldTripItem[]> = {};
      (items ?? []).forEach(item => {
        if (!byTrip[item.field_trip_id]) byTrip[item.field_trip_id] = [];
        byTrip[item.field_trip_id].push(item);
      });
      setItemsByTrip(byTrip);

      const tripMap = Object.fromEntries(allTrips.map(t => [t.id, t.title]));
      const completed = (items ?? []).filter(i => i.status === 'completed')
        .map(i => ({ ...i, trip_title: tripMap[i.field_trip_id] ?? '' }));
      setCompletedItems(completed);
    } else {
      setItemsByTrip({});
      setCompletedItems([]);
    }
    setLoading(false);
  };

  // Kakao map script
  useEffect(() => {
    if (!authChecked) return;
    if (window.kakao?.maps) { setMapReady(true); return; }
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => { window.kakao.maps.load(() => setMapReady(true)); };
    document.head.appendChild(script);
  }, [authChecked]);

  // Initialize map
  useEffect(() => {
    if (!showMap || !mapReady || !mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = new window.kakao.maps.Map(mapRef.current, {
      center: new window.kakao.maps.LatLng(37.5040, 126.7656),
      level: 5,
    });
  }, [showMap, mapReady]);

  // Update markers on map
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady || !showMap) return;
    markersRef.current.forEach(m => m.setMap(null));
    overlaysRef.current.forEach(o => o.setMap(null));
    markersRef.current = [];
    overlaysRef.current = [];

    if (!expandedTrip) return;
    const items = (itemsByTrip[expandedTrip] ?? []).filter(i => i.status === 'planned' && i.latitude && i.longitude);
    const latlngs: any[] = [];

    items.forEach((item, idx) => {
      const pos = new window.kakao.maps.LatLng(item.latitude!, item.longitude!);
      latlngs.push(pos);

      const marker = new window.kakao.maps.Marker({ position: pos, map: mapInstanceRef.current });
      const overlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        content: `<div style="background:#c47c30;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);margin-bottom:32px">${idx + 1}</div>`,
        yAnchor: 0,
        zIndex: 3,
      });
      overlay.setMap(mapInstanceRef.current);
      markersRef.current.push(marker);
      overlaysRef.current.push(overlay);
    });

    if (latlngs.length > 0) {
      const bounds = new window.kakao.maps.LatLngBounds();
      latlngs.forEach(ll => bounds.extend(ll));
      mapInstanceRef.current.setBounds(bounds);
    }
  }, [expandedTrip, itemsByTrip, mapReady, showMap]);

  const showMyLocation = () => {
    if (!mapInstanceRef.current) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const me = new window.kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
      new window.kakao.maps.Marker({ position: me, map: mapInstanceRef.current });
      mapInstanceRef.current.setCenter(me);
    }, () => alert('위치 정보를 가져올 수 없습니다.'));
  };

  const openKakaoNavi = () => {
    if (!expandedTrip) return;
    const items = (itemsByTrip[expandedTrip] ?? []).filter(i => i.status === 'planned');
    if (items.length === 0) { alert('임장할 매물이 없습니다.'); return; }

    if (items.length === 1 && items[0].latitude && items[0].longitude) {
      const label = encodeURIComponent(items[0].building_name || items[0].address);
      window.open(`https://map.kakao.com/link/to/${label},${items[0].latitude},${items[0].longitude}`, '_blank');
    } else if (items[0].latitude && items[0].longitude) {
      // Multi-stop: link to first, user sets route manually
      const label = encodeURIComponent(items[0].building_name || items[0].address);
      window.open(`https://map.kakao.com/link/to/${label},${items[0].latitude},${items[0].longitude}`, '_blank');
    } else {
      const addr = encodeURIComponent(items[0].address);
      window.open(`https://map.kakao.com/?q=${addr}`, '_blank');
    }
  };

  const handleAddTrip = async () => {
    if (!tripForm.title.trim()) { alert('제목을 입력하세요.'); return; }
    if (!tripForm.trip_date) { alert('날짜를 선택하세요.'); return; }
    setSavingTrip(true);
    const { error } = await supabase.from('field_trips').insert({
      title: tripForm.title.trim(),
      trip_date: tripForm.trip_date,
      agent_id: tripForm.agent_id || null,
      status: 'planned',
    });
    setSavingTrip(false);
    if (error) { alert(`저장 실패: ${error.message}`); return; }
    setTripForm({ title: '', trip_date: new Date().toISOString().slice(0, 10), agent_id: '' });
    setShowAddTrip(false);
    showToast('일정이 추가되었습니다.');
    loadAll();
  };

  const handleAddItem = async (tripId: string) => {
    const existingItems = itemsByTrip[tripId] ?? [];
    const nextOrder = existingItems.length + 1;
    let addr = '', bname = '', propId: string | null = null;
    let lat: number | null = null, lng: number | null = null;

    if (itemMode === 'property') {
      if (!selectedPropId) { alert('매물을 선택하세요.'); return; }
      const prop = propOptions.find(p => p.id === selectedPropId);
      if (!prop) { alert('매물을 선택하세요.'); return; }
      addr = prop.address;
      bname = prop.building_name ?? '';
      propId = prop.id;
      lat = prop.latitude;
      lng = prop.longitude;
    } else {
      if (!itemForm.address.trim()) { alert('주소를 입력하세요.'); return; }
      addr = itemForm.address.trim();
      bname = itemForm.building_name.trim();
      if (mapReady && window.kakao?.maps?.services) {
        const geocoder = new window.kakao.maps.services.Geocoder();
        await new Promise<void>(resolve => {
          geocoder.addressSearch(addr, (result: any, status: any) => {
            if (status === window.kakao.maps.services.Status.OK && result[0]) {
              lat = parseFloat(result[0].y);
              lng = parseFloat(result[0].x);
            }
            resolve();
          });
        });
      }
    }

    setSavingItem(true);
    const checklist: Record<string, boolean> = Object.fromEntries(CHECKLIST_KEYS.map(k => [k, false]));
    const { error } = await supabase.from('field_trip_items').insert({
      field_trip_id: tripId, property_id: propId,
      address: addr, building_name: bname || null,
      order_num: nextOrder, status: 'planned',
      checklist, latitude: lat, longitude: lng,
    });
    setSavingItem(false);
    if (error) { alert(`추가 실패: ${error.message}`); return; }
    setAddItemFor(null);
    setPropSearch(''); setSelectedPropId('');
    setItemForm({ address: '', building_name: '' });
    showToast('매물이 추가되었습니다.');
    loadAll();
  };

  const moveItem = async (tripId: string, idx: number, dir: -1 | 1) => {
    const items = [...(itemsByTrip[tripId] ?? []).filter(i => i.status === 'planned')];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
    await Promise.all(items.map((item, i) =>
      supabase.from('field_trip_items').update({ order_num: i + 1 }).eq('id', item.id)
    ));
    setItemsByTrip(prev => {
      const completed = (prev[tripId] ?? []).filter(i => i.status === 'completed');
      return { ...prev, [tripId]: [...items.map((it, i) => ({ ...it, order_num: i + 1 })), ...completed] };
    });
  };

  const completeItem = async (item: FieldTripItem) => {
    const { error } = await supabase.from('field_trip_items').update({ status: 'completed' }).eq('id', item.id);
    if (error) { alert(`오류: ${error.message}`); return; }
    showToast('임장 완료!');
    loadAll();
  };

  const openDetail = (item: FieldTripItem) => {
    setDetailItem(item);
    setDetailMemo(item.memo ?? '');
    setDetailChecklist(item.checklist ?? Object.fromEntries(CHECKLIST_KEYS.map(k => [k, false])));
  };

  const saveDetail = async () => {
    if (!detailItem) return;
    setSavingDetail(true);
    const { error } = await supabase.from('field_trip_items')
      .update({ memo: detailMemo || null, checklist: detailChecklist })
      .eq('id', detailItem.id);
    setSavingDetail(false);
    if (error) { alert(`저장 실패: ${error.message}`); return; }
    setDetailItem(null);
    showToast('저장되었습니다.');
    loadAll();
  };

  const deleteItem = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await supabase.from('field_trip_items').delete().eq('id', id);
    showToast('삭제되었습니다.');
    loadAll();
  };

  const deleteTrip = async (id: string) => {
    if (!confirm('일정과 매물 목록이 모두 삭제됩니다. 계속하시겠습니까?')) return;
    await supabase.from('field_trip_items').delete().eq('field_trip_id', id);
    await supabase.from('field_trips').delete().eq('id', id);
    if (expandedTrip === id) setExpandedTrip(null);
    showToast('일정이 삭제되었습니다.');
    loadAll();
  };

  const plannedTrips = trips.filter(t => t.status === 'planned');
  const filteredProps = propOptions.filter(p =>
    !propSearch ||
    p.address.includes(propSearch) ||
    (p.building_name ?? '').includes(propSearch) ||
    (p.title ?? '').includes(propSearch) ||
    p.property_number.includes(propSearch)
  ).slice(0, 20);

  if (!authChecked) return null;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', minHeight: '100vh', background: '#f8f8f8', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 20 }}>
        <button onClick={() => router.push('/admin')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: '20px', padding: 0, lineHeight: 1 }}>←</button>
        <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#1a1a1a' }}>임장노트</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #eee' }}>
        {(['planned', 'completed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '13px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 600,
              color: tab === t ? '#c47c30' : '#aaa',
              borderBottom: tab === t ? '2px solid #c47c30' : '2px solid transparent',
            }}>
            {t === 'planned' ? `예정 (${plannedTrips.length})` : `완료 (${completedItems.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#999', fontSize: '14px' }}>로딩 중...</div>
      ) : tab === 'planned' ? (
        /* ─── 예정 탭 ─── */
        <div>
          {/* Map controls (only when a trip is expanded) */}
          {expandedTrip && (
            <div style={{ padding: '10px 16px', background: '#fff', borderBottom: '1px solid #eee', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setShowMap(v => !v)}
                style={{ padding: '7px 14px', border: '1px solid #ddd', borderRadius: '20px', background: showMap ? '#1a1a1a' : '#fff', color: showMap ? '#e2a06e' : '#555', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                {showMap ? '지도 숨기기' : '🗺 지도 보기'}
              </button>
              {showMap && (
                <>
                  <button onClick={showMyLocation}
                    style={{ padding: '7px 14px', border: '1px solid #ddd', borderRadius: '20px', background: '#fff', color: '#555', fontSize: '13px', cursor: 'pointer' }}>
                    📍 내 위치
                  </button>
                  <button onClick={openKakaoNavi}
                    style={{ padding: '7px 14px', border: '1px solid #c47c30', borderRadius: '20px', background: '#c47c30', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    카카오맵 길찾기
                  </button>
                </>
              )}
            </div>
          )}

          {/* Kakao map */}
          <div ref={mapRef} style={{ height: showMap && expandedTrip ? '240px' : '0', overflow: 'hidden', transition: 'height 0.2s' }} />

          {/* Add trip button */}
          <div style={{ padding: '12px 16px' }}>
            <button onClick={() => setShowAddTrip(v => !v)}
              style={{ width: '100%', padding: '13px', border: '2px dashed #ddd', borderRadius: '8px', background: '#fff', color: showAddTrip ? '#999' : '#c47c30', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              {showAddTrip ? '닫기' : '+ 임장 일정 추가'}
            </button>
          </div>

          {/* Add trip form */}
          {showAddTrip && (
            <div style={{ margin: '0 16px 12px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>제목 *</label>
                  <input style={inputSt} placeholder="예: 중동 임장" value={tripForm.title}
                    onChange={e => setTripForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>날짜 *</label>
                  <input type="date" style={inputSt} value={tripForm.trip_date}
                    onChange={e => setTripForm(f => ({ ...f, trip_date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>담당자</label>
                  <select style={inputSt} value={tripForm.agent_id}
                    onChange={e => setTripForm(f => ({ ...f, agent_id: e.target.value }))}>
                    <option value="">선택 안 함</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}{a.title ? ` ${a.title}` : ''}</option>)}
                  </select>
                </div>
                <button onClick={handleAddTrip} disabled={savingTrip}
                  style={{ padding: '12px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: savingTrip ? 'not-allowed' : 'pointer', opacity: savingTrip ? 0.6 : 1 }}>
                  {savingTrip ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}

          {/* Trip list */}
          {plannedTrips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa', fontSize: '14px' }}>
              예정된 임장 일정이 없습니다.
            </div>
          ) : (
            <div>
              {plannedTrips.map(trip => {
                const allItems = itemsByTrip[trip.id] ?? [];
                const plannedItems = allItems.filter(i => i.status === 'planned');
                const doneCount = allItems.filter(i => i.status === 'completed').length;
                const agent = agents.find(a => a.id === trip.agent_id);
                const isExpanded = expandedTrip === trip.id;

                return (
                  <div key={trip.id} style={{ background: '#fff', borderBottom: '1px solid #eee' }}>
                    {/* Trip header */}
                    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                      onClick={() => setExpandedTrip(isExpanded ? null : trip.id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>{trip.title}</span>
                          {agent && <span style={{ fontSize: '12px', color: '#888' }}>{agent.name}</span>}
                        </div>
                        <div style={{ fontSize: '13px', marginTop: '3px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: '#c47c30' }}>{trip.trip_date}</span>
                          <span style={{ color: '#ccc' }}>|</span>
                          <span style={{ color: '#666' }}>
                            매물 {plannedItems.length}건{doneCount > 0 ? ` · 완료 ${doneCount}` : ''}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); deleteTrip(trip.id); }}
                          style={{ padding: '6px 10px', border: '1px solid #fee2e2', color: '#dc2626', background: '#fff', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                          삭제
                        </button>
                        <span style={{ color: '#bbb', fontSize: '14px', userSelect: 'none' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Trip items (expanded) */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #f0f0f0' }}>
                        {plannedItems.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>매물을 추가해주세요.</div>
                        ) : (
                          plannedItems.map((item, idx) => (
                            <div key={item.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f5f5f5', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                              {/* Order badge */}
                              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#c47c30', color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                                {idx + 1}
                              </div>
                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.4 }}>
                                  {item.building_name ? `${item.address} ${item.building_name}` : item.address}
                                </div>
                                {item.memo && (
                                  <div style={{ fontSize: '12px', color: '#888', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.memo}
                                  </div>
                                )}
                                {item.checklist && (
                                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                                    체크 {Object.values(item.checklist).filter(Boolean).length}/{CHECKLIST_KEYS.length}
                                  </div>
                                )}
                              </div>
                              {/* Actions */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0, alignItems: 'flex-end' }}>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={() => moveItem(trip.id, idx, -1)} disabled={idx === 0}
                                    style={{ padding: '5px 9px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', color: idx === 0 ? '#ccc' : '#555', fontSize: '13px', cursor: idx === 0 ? 'default' : 'pointer' }}>
                                    ▲
                                  </button>
                                  <button onClick={() => moveItem(trip.id, idx, 1)} disabled={idx === plannedItems.length - 1}
                                    style={{ padding: '5px 9px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', color: idx === plannedItems.length - 1 ? '#ccc' : '#555', fontSize: '13px', cursor: idx === plannedItems.length - 1 ? 'default' : 'pointer' }}>
                                    ▼
                                  </button>
                                </div>
                                <button onClick={() => openDetail(item)}
                                  style={{ padding: '5px 9px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', color: '#444', fontSize: '12px', cursor: 'pointer', width: '100%' }}>
                                  메모
                                </button>
                                <button onClick={() => completeItem(item)}
                                  style={{ padding: '5px 9px', border: 'none', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontSize: '12px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                                  완료 ✓
                                </button>
                              </div>
                            </div>
                          ))
                        )}

                        {/* Add item */}
                        <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
                          {addItemFor !== trip.id ? (
                            <button onClick={() => { setAddItemFor(trip.id); setItemMode('property'); setPropSearch(''); setSelectedPropId(''); setItemForm({ address: '', building_name: '' }); }}
                              style={{ width: '100%', padding: '11px', border: '1px dashed #ddd', borderRadius: '6px', background: '#fafafa', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
                              + 매물 추가
                            </button>
                          ) : (
                            <div>
                              {/* Mode toggle */}
                              <div style={{ display: 'flex', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' }}>
                                {(['property', 'manual'] as const).map(m => (
                                  <button key={m} onClick={() => setItemMode(m)}
                                    style={{ flex: 1, padding: '10px', border: 'none', background: itemMode === m ? '#1a1a1a' : '#fff', color: itemMode === m ? '#fff' : '#666', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                                    {m === 'property' ? '기존 매물' : '주소 직접 입력'}
                                  </button>
                                ))}
                              </div>

                              {itemMode === 'property' ? (
                                <div style={{ marginBottom: '8px' }}>
                                  <input style={{ ...inputSt, marginBottom: '6px' }}
                                    placeholder="매물 검색 (주소, 건물명, 매물번호)"
                                    value={propSearch}
                                    onChange={e => { setPropSearch(e.target.value); setSelectedPropId(''); }} />
                                  {propSearch && (
                                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px', background: '#fff' }}>
                                      {filteredProps.length === 0 ? (
                                        <div style={{ padding: '14px', color: '#aaa', fontSize: '13px', textAlign: 'center' }}>검색 결과 없음</div>
                                      ) : filteredProps.map(prop => (
                                        <div key={prop.id}
                                          onClick={() => { setSelectedPropId(prop.id); setPropSearch(`[${prop.property_number}] ${prop.address}${prop.building_name ? ` ${prop.building_name}` : ''}`); }}
                                          style={{ padding: '10px 12px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: selectedPropId === prop.id ? '#fff8f2' : '#fff' }}>
                                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>[{prop.property_number}] {prop.address}</div>
                                          {prop.building_name && <div style={{ fontSize: '12px', color: '#888' }}>{prop.building_name}</div>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                                  <input style={inputSt} placeholder="주소 *" value={itemForm.address}
                                    onChange={e => setItemForm(f => ({ ...f, address: e.target.value }))} />
                                  <input style={inputSt} placeholder="건물명 (선택)" value={itemForm.building_name}
                                    onChange={e => setItemForm(f => ({ ...f, building_name: e.target.value }))} />
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleAddItem(trip.id)} disabled={savingItem}
                                  style={{ flex: 1, padding: '11px', background: '#c47c30', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: savingItem ? 'not-allowed' : 'pointer', opacity: savingItem ? 0.6 : 1 }}>
                                  {savingItem ? '추가 중...' : '추가'}
                                </button>
                                <button onClick={() => setAddItemFor(null)}
                                  style={{ padding: '11px 16px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>
                                  취소
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ─── 완료 탭 ─── */
        <div>
          {completedItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa', fontSize: '14px' }}>완료된 임장 매물이 없습니다.</div>
          ) : (
            <div>
              {completedItems.map(item => (
                <div key={item.id} style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>{item.trip_title}</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.4 }}>
                        {item.building_name ? `${item.address} ${item.building_name}` : item.address}
                      </div>
                      {item.memo && (
                        <div style={{ fontSize: '13px', color: '#555', marginTop: '6px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {item.memo}
                        </div>
                      )}
                      {item.checklist && (
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {CHECKLIST_KEYS.map(k => (
                            <span key={k} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                              background: item.checklist![k] ? '#dcfce7' : '#f3f4f6',
                              color: item.checklist![k] ? '#166534' : '#999' }}>
                              {item.checklist![k] ? '✓' : '·'} {k}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => openDetail(item)}
                        style={{ padding: '7px 12px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', color: '#444', fontSize: '12px', cursor: 'pointer' }}>
                        수정
                      </button>
                      <a href="/admin/properties/new"
                        style={{ display: 'block', padding: '7px 12px', border: '1px solid #c47c30', borderRadius: '4px', background: '#fff', color: '#c47c30', fontSize: '12px', fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>
                        매물 등록
                      </a>
                      <button onClick={() => deleteItem(item.id)}
                        style={{ padding: '7px 12px', border: '1px solid #fee2e2', borderRadius: '4px', background: '#fff', color: '#dc2626', fontSize: '12px', cursor: 'pointer' }}>
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 메모/체크리스트 모달 ─── */}
      {detailItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', width: '100%', maxHeight: '85vh', borderRadius: '16px 16px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, marginRight: '12px' }}>
                <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>메모 & 체크리스트</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.4 }}>
                  {detailItem.building_name ? `${detailItem.address} ${detailItem.building_name}` : detailItem.address}
                </div>
              </div>
              <button onClick={() => setDetailItem(null)}
                style={{ background: 'none', border: 'none', fontSize: '24px', color: '#999', cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>메모</label>
                <textarea value={detailMemo} onChange={e => setDetailMemo(e.target.value)}
                  placeholder="임장 메모를 입력하세요" rows={4}
                  style={{ width: '100%', border: '1px solid #ddd', borderRadius: '6px', padding: '10px 12px', fontSize: '14px', lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '8px' }}>체크리스트</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {CHECKLIST_KEYS.map(key => (
                    <label key={key}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', background: detailChecklist[key] ? '#f0fdf4' : '#fafafa', borderRadius: '8px', cursor: 'pointer', border: `1px solid ${detailChecklist[key] ? '#bbf7d0' : '#f0f0f0'}` }}>
                      <input type="checkbox" checked={detailChecklist[key] ?? false}
                        onChange={e => setDetailChecklist(prev => ({ ...prev, [key]: e.target.checked }))}
                        style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#166534', flexShrink: 0 }} />
                      <span style={{ fontSize: '14px', color: detailChecklist[key] ? '#166534' : '#444', fontWeight: detailChecklist[key] ? 600 : 400 }}>
                        {key}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #eee' }}>
              <button onClick={saveDetail} disabled={savingDetail}
                style={{ width: '100%', padding: '14px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: savingDetail ? 'not-allowed' : 'pointer', opacity: savingDetail ? 0.6 : 1 }}>
                {savingDetail ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 22px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, zIndex: 200, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
