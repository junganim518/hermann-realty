'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

declare global { interface Window { kakao: any; } }

const KAKAO_KEY = '8a478b4b6ea5e02722a33f6ac2fa34b6';
const TODAY = new Date().toISOString().slice(0, 10);

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
  const [loading, setLoading] = useState(true);

  // Map
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);
  const searchMarkerRef = useRef<any>(null);
  const searchOverlayRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Map search & pending location
  const [mapSearch, setMapSearch] = useState('');
  const [pendingLocation, setPendingLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);

  // Save modal (임장 추가)
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | string>('new');
  const [saveForm, setSaveForm] = useState({ address: '', building_name: '', title: '', trip_date: TODAY, agent_id: '' });
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (!authChecked) return;
    loadAll();
  }, [authChecked]);

  const loadAll = async () => {
    setLoading(true);
    const [tripsRes, agentsRes] = await Promise.all([
      supabase.from('field_trips').select('*').order('trip_date', { ascending: false }),
      supabase.from('agents').select('id, name, title').eq('is_active', true),
    ]);

    const allTrips: FieldTrip[] = tripsRes.data ?? [];
    setTrips(allTrips);
    setAgents(agentsRes.data ?? []);

    if (allTrips.length > 0) {
      const { data: items } = await supabase
        .from('field_trip_items').select('*')
        .in('field_trip_id', allTrips.map(t => t.id))
        .order('order_num', { ascending: true });

      const byTrip: Record<string, FieldTripItem[]> = {};
      (items ?? []).forEach(item => {
        if (!byTrip[item.field_trip_id]) byTrip[item.field_trip_id] = [];
        byTrip[item.field_trip_id].push(item);
      });
      setItemsByTrip(byTrip);

      const tripMap = Object.fromEntries(allTrips.map(t => [t.id, t.title]));
      setCompletedItems((items ?? []).filter(i => i.status === 'completed')
        .map(i => ({ ...i, trip_title: tripMap[i.field_trip_id] ?? '' })));
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

  // Initialize map — mapRef.current is always mounted (display:none hides it)
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return;
    const map = new window.kakao.maps.Map(mapRef.current, {
      center: new window.kakao.maps.LatLng(37.5040, 126.7656),
      level: 5,
    });
    mapInstanceRef.current = map;

    // Map click → reverse geocode → pendingLocation
    window.kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
      const latlng = mouseEvent.latLng;
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2Address(latlng.getLng(), latlng.getLat(), (result: any, status: any) => {
        let addr = '';
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          addr = result[0].address?.address_name || result[0].road_address?.address_name || '';
        }
        setPendingLocation({ address: addr, lat: latlng.getLat(), lng: latlng.getLng() });
        setSaveForm(f => ({ ...f, address: addr, building_name: '' }));
      });
    });
  }, [mapReady]);

  // relayout when map becomes visible after being hidden
  useEffect(() => {
    if (tab === 'planned' && !loading && mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.relayout(), 50);
    }
  }, [tab, loading]);

  // Search result pin
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    if (searchMarkerRef.current) { searchMarkerRef.current.setMap(null); searchMarkerRef.current = null; }
    if (searchOverlayRef.current) { searchOverlayRef.current.setMap(null); searchOverlayRef.current = null; }
    if (!pendingLocation) return;

    const pos = new window.kakao.maps.LatLng(pendingLocation.lat, pendingLocation.lng);
    searchMarkerRef.current = new window.kakao.maps.Marker({ position: pos, map: mapInstanceRef.current });
    searchOverlayRef.current = new window.kakao.maps.CustomOverlay({
      position: pos,
      content: `<div style="background:#1a1a1a;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;margin-bottom:42px;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${pendingLocation.address || '선택된 위치'}</div>`,
      yAnchor: 0, zIndex: 5,
    });
    searchOverlayRef.current.setMap(mapInstanceRef.current);
    mapInstanceRef.current.setCenter(pos);
  }, [pendingLocation, mapReady]);

  // Existing planned item markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    markersRef.current.forEach(m => m.setMap(null));
    overlaysRef.current.forEach(o => o.setMap(null));
    markersRef.current = [];
    overlaysRef.current = [];

    const plannedTrips = trips.filter(t => t.status === 'planned');
    const itemsToShow: FieldTripItem[] = expandedTrip
      ? (itemsByTrip[expandedTrip] ?? []).filter(i => i.status === 'planned' && i.latitude && i.longitude)
      : plannedTrips.flatMap(t => (itemsByTrip[t.id] ?? []).filter(i => i.status === 'planned' && i.latitude && i.longitude));

    const latlngs: any[] = [];
    itemsToShow.forEach((item, idx) => {
      const pos = new window.kakao.maps.LatLng(item.latitude!, item.longitude!);
      latlngs.push(pos);
      const marker = new window.kakao.maps.Marker({ position: pos, map: mapInstanceRef.current });
      const overlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        content: `<div style="background:#c47c30;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,0.3);margin-bottom:32px">${idx + 1}</div>`,
        yAnchor: 0, zIndex: 3,
      });
      overlay.setMap(mapInstanceRef.current);
      markersRef.current.push(marker);
      overlaysRef.current.push(overlay);
    });

    if (latlngs.length > 0 && !pendingLocation) {
      const bounds = new window.kakao.maps.LatLngBounds();
      latlngs.forEach(ll => bounds.extend(ll));
      mapInstanceRef.current.setBounds(bounds);
    }
  }, [expandedTrip, itemsByTrip, mapReady, trips]);

  const searchAddress = () => {
    if (!mapSearch.trim() || !mapReady) return;
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(mapSearch.trim(), (result: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        const lat = parseFloat(result[0].y);
        const lng = parseFloat(result[0].x);
        const addr = result[0].address?.address_name || result[0].address_name || '';
        setPendingLocation({ address: addr, lat, lng });
        setSaveForm(f => ({ ...f, address: addr, building_name: '' }));
      } else {
        alert('주소를 찾을 수 없습니다.');
      }
    });
  };

  const showMyLocation = () => {
    if (!mapInstanceRef.current) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const me = new window.kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
      new window.kakao.maps.Marker({ position: me, map: mapInstanceRef.current });
      mapInstanceRef.current.setCenter(me);
    }, () => alert('위치 정보를 가져올 수 없습니다.'));
  };

  const openSaveModal = () => {
    if (!pendingLocation) return;
    setSaveMode('new');
    setSaveForm(f => ({ ...f, title: '', trip_date: TODAY, agent_id: '' }));
    setShowSaveModal(true);
  };

  const handleSave = async () => {
    if (!pendingLocation) return;
    if (!saveForm.address.trim()) { alert('주소를 확인하세요.'); return; }
    setSaving(true);

    let tripId = saveMode;
    if (saveMode === 'new') {
      if (!saveForm.title.trim()) { alert('일정 제목을 입력하세요.'); setSaving(false); return; }
      const { data: tripData, error: tripErr } = await supabase.from('field_trips').insert({
        title: saveForm.title.trim(),
        trip_date: saveForm.trip_date,
        agent_id: saveForm.agent_id || null,
        status: 'planned',
      }).select().single();
      if (tripErr || !tripData) { alert(`저장 실패: ${tripErr?.message}`); setSaving(false); return; }
      tripId = tripData.id;
    }

    const existingPlanned = (itemsByTrip[tripId] ?? []).filter(i => i.status === 'planned');
    const checklist = Object.fromEntries(CHECKLIST_KEYS.map(k => [k, false]));
    const { error: itemErr } = await supabase.from('field_trip_items').insert({
      field_trip_id: tripId,
      address: saveForm.address.trim(),
      building_name: saveForm.building_name.trim() || null,
      order_num: existingPlanned.length + 1,
      status: 'planned', checklist,
      latitude: pendingLocation.lat, longitude: pendingLocation.lng,
    });
    setSaving(false);
    if (itemErr) { alert(`추가 실패: ${itemErr.message}`); return; }
    setShowSaveModal(false);
    setPendingLocation(null);
    setMapSearch('');
    showToast('임장 매물이 추가되었습니다.');
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
    await supabase.from('field_trip_items').update({ status: 'completed' }).eq('id', item.id);
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
    await supabase.from('field_trip_items')
      .update({ memo: detailMemo || null, checklist: detailChecklist })
      .eq('id', detailItem.id);
    setSavingDetail(false);
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
    if (!confirm('일정과 매물 목록이 모두 삭제됩니다.')) return;
    await supabase.from('field_trip_items').delete().eq('field_trip_id', id);
    await supabase.from('field_trips').delete().eq('id', id);
    if (expandedTrip === id) setExpandedTrip(null);
    showToast('일정이 삭제되었습니다.');
    loadAll();
  };

  const plannedTrips = trips.filter(t => t.status === 'planned');

  if (!authChecked) return null;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', height: '100dvh', background: '#f8f8f8', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={() => router.push('/admin')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: '20px', padding: 0, lineHeight: 1 }}>←</button>
        <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#1a1a1a' }}>임장노트</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #eee', flexShrink: 0 }}>
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

      {/* ─── 지도 영역: 항상 DOM에 유지, 예정 탭 + 로딩 완료 시만 표시 ─── */}
      <div style={{ height: '60%', position: 'relative', flexShrink: 0, display: (tab === 'planned' && !loading) ? 'block' : 'none' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* Address search overlay */}
        <div style={{ position: 'absolute', top: '10px', left: '10px', right: '54px', zIndex: 10, display: 'flex', gap: '6px' }}>
          <input
            style={{ flex: 1, height: '40px', border: 'none', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', boxSizing: 'border-box' }}
            placeholder="주소 검색"
            value={mapSearch}
            onChange={e => setMapSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchAddress()}
          />
          <button onClick={searchAddress}
            style={{ height: '40px', padding: '0 14px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
            검색
          </button>
        </div>

        {/* My location button */}
        <button onClick={showMyLocation}
          style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, width: '38px', height: '40px', background: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          📍
        </button>

        {/* 임장 추가 button */}
        {pendingLocation && (
          <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            <button onClick={openSaveModal}
              style={{ padding: '12px 28px', background: '#c47c30', color: '#fff', border: 'none', borderRadius: '24px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(196,124,48,0.55)', whiteSpace: 'nowrap' }}>
              + 임장 추가
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#999', fontSize: '14px' }}>로딩 중...</div>
      ) : tab === 'planned' ? (
        /* ─── 예정 탭: 리스트 (40%) ─── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* List (scrollable) */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#f8f8f8' }}>
            {plannedTrips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: '#aaa', fontSize: '14px' }}>
                지도에서 주소를 검색하고 임장을 추가하세요.
              </div>
            ) : (
              plannedTrips.map(trip => {
                const allItems = itemsByTrip[trip.id] ?? [];
                const plannedItems = allItems.filter(i => i.status === 'planned');
                const doneCount = allItems.filter(i => i.status === 'completed').length;
                const agent = agents.find(a => a.id === trip.agent_id);
                const isExpanded = expandedTrip === trip.id;

                return (
                  <div key={trip.id} style={{ background: '#fff', borderBottom: '1px solid #eee' }}>
                    {/* Trip header */}
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
                      onClick={() => setExpandedTrip(isExpanded ? null : trip.id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>{trip.title}</span>
                          {agent && <span style={{ fontSize: '12px', color: '#888' }}>{agent.name}</span>}
                        </div>
                        <div style={{ fontSize: '13px', marginTop: '2px', display: 'flex', gap: '8px' }}>
                          <span style={{ color: '#c47c30' }}>{trip.trip_date}</span>
                          <span style={{ color: '#ccc' }}>|</span>
                          <span style={{ color: '#666' }}>매물 {plannedItems.length}건{doneCount > 0 ? ` · 완료 ${doneCount}` : ''}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); deleteTrip(trip.id); }}
                          style={{ padding: '5px 10px', border: '1px solid #fee2e2', color: '#dc2626', background: '#fff', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                          삭제
                        </button>
                        <span style={{ color: '#bbb', fontSize: '14px', userSelect: 'none' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Trip items */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #f0f0f0' }}>
                        {plannedItems.length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>매물을 추가해주세요.</div>
                        ) : (
                          plannedItems.map((item, idx) => (
                            <div key={item.id} style={{ padding: '11px 16px', borderBottom: '1px solid #f5f5f5', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#c47c30', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                                {idx + 1}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.4 }}>
                                  {item.building_name ? `${item.address} ${item.building_name}` : item.address}
                                </div>
                                {item.memo && (
                                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.memo}</div>
                                )}
                                {item.checklist && (
                                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                                    체크 {Object.values(item.checklist).filter(Boolean).length}/{CHECKLIST_KEYS.length}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                                <div style={{ display: 'flex', gap: '3px' }}>
                                  <button onClick={() => moveItem(trip.id, idx, -1)} disabled={idx === 0}
                                    style={{ padding: '4px 7px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', color: idx === 0 ? '#ccc' : '#555', fontSize: '12px', cursor: idx === 0 ? 'default' : 'pointer' }}>▲</button>
                                  <button onClick={() => moveItem(trip.id, idx, 1)} disabled={idx === plannedItems.length - 1}
                                    style={{ padding: '4px 7px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', color: idx === plannedItems.length - 1 ? '#ccc' : '#555', fontSize: '12px', cursor: idx === plannedItems.length - 1 ? 'default' : 'pointer' }}>▼</button>
                                </div>
                                <button onClick={() => openDetail(item)}
                                  style={{ padding: '4px 7px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', color: '#444', fontSize: '11px', cursor: 'pointer' }}>메모</button>
                                <button onClick={() => completeItem(item)}
                                  style={{ padding: '4px 7px', border: 'none', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>완료✓</button>
                                <button onClick={() => deleteItem(item.id)}
                                  style={{ padding: '4px 7px', border: '1px solid #fee2e2', borderRadius: '4px', background: '#fff', color: '#dc2626', fontSize: '11px', cursor: 'pointer' }}>삭제</button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* ─── 완료 탭 ─── */
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {completedItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa', fontSize: '14px' }}>완료된 임장 매물이 없습니다.</div>
          ) : (
            completedItems.map(item => (
              <div key={item.id} style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>{item.trip_title}</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.4 }}>
                      {item.building_name ? `${item.address} ${item.building_name}` : item.address}
                    </div>
                    {item.memo && (
                      <div style={{ fontSize: '13px', color: '#555', marginTop: '6px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{item.memo}</div>
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
                      style={{ padding: '7px 12px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', color: '#444', fontSize: '12px', cursor: 'pointer' }}>수정</button>
                    <a href="/admin/properties/new"
                      style={{ display: 'block', padding: '7px 12px', border: '1px solid #c47c30', borderRadius: '4px', background: '#fff', color: '#c47c30', fontSize: '12px', fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>매물 등록</a>
                    <button onClick={() => deleteItem(item.id)}
                      style={{ padding: '7px 12px', border: '1px solid #fee2e2', borderRadius: '4px', background: '#fff', color: '#dc2626', fontSize: '12px', cursor: 'pointer' }}>삭제</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── 임장 추가 저장 모달 ─── */}
      {showSaveModal && pendingLocation && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '640px', margin: '0 auto', maxHeight: '80vh', borderRadius: '16px 16px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>임장 추가</div>
              <button onClick={() => setShowSaveModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', color: '#999', cursor: 'pointer', padding: 0 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>주소</label>
                <input style={inputSt} value={saveForm.address}
                  onChange={e => setSaveForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>건물명 (선택)</label>
                <input style={inputSt} placeholder="예: 메가타워" value={saveForm.building_name}
                  onChange={e => setSaveForm(f => ({ ...f, building_name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>일정</label>
                <select style={inputSt} value={saveMode} onChange={e => setSaveMode(e.target.value)}>
                  <option value="new">새 일정 만들기</option>
                  {plannedTrips.map(t => <option key={t.id} value={t.id}>{t.title} ({t.trip_date})</option>)}
                </select>
              </div>
              {saveMode === 'new' && (
                <>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>일정 제목 *</label>
                    <input style={inputSt} placeholder="예: 중동 임장" value={saveForm.title}
                      onChange={e => setSaveForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>날짜 *</label>
                    <input type="date" style={inputSt} value={saveForm.trip_date}
                      onChange={e => setSaveForm(f => ({ ...f, trip_date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>담당자</label>
                    <select style={inputSt} value={saveForm.agent_id} onChange={e => setSaveForm(f => ({ ...f, agent_id: e.target.value }))}>
                      <option value="">선택 안 함</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.name}{a.title ? ` ${a.title}` : ''}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #eee' }}>
              <button onClick={handleSave} disabled={saving}
                style={{ width: '100%', padding: '14px', background: '#c47c30', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 메모/체크리스트 모달 ─── */}
      {detailItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '640px', margin: '0 auto', maxHeight: '85vh', borderRadius: '16px 16px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                      <span style={{ fontSize: '14px', color: detailChecklist[key] ? '#166534' : '#444', fontWeight: detailChecklist[key] ? 600 : 400 }}>{key}</span>
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
