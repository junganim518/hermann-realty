'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { parseTimeString, isoToTimeString, combineDateTime } from '@/lib/parseTime';

const SCHEDULE_TYPES = ['방문', '계약', '상담', '잔금', '개인', '기타'] as const;
type ScheduleType = typeof SCHEDULE_TYPES[number];

const SCHEDULE_COLORS: Record<ScheduleType, string> = {
  '방문': '#2196F3',
  '계약': '#e2a06e',
  '상담': '#4caf50',
  '잔금': '#9c27b0',
  '개인': '#e91e63',
  '기타': '#888',
};

const STATUS_COLORS: Record<string, string> = {
  '상담중': '#888',
  '방문예정': '#2196F3',
  '방문완료': '#4caf50',
  '계약진행': '#e2a06e',
  '계약완료': '#e05050',
  '보류': '#bbb',
};

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= lastDate; d++) days.push(d);
  return days;
}

type ScheduleRow = {
  id: string;
  title: string;
  schedule_date: string;
  type: string;
  customer_id: string | null;
  memo: string | null;
};

type Customer = {
  id: string;
  name: string;
  phone?: string;
  visit_date?: string;
  status?: string;
  interest_type?: string;
  region?: string;
};

type CalItem =
  | { key: string; source: 'schedule'; color: string; label: string; iso: string; schedule: ScheduleRow }
  | { key: string; source: 'customer'; color: string; label: string; iso: string; customer: Customer };

type ModalData = {
  id?: string;
  title: string;
  date: string;
  time: string;
  type: ScheduleType;
  customer_id: string | null;
  memo: string;
};

const emptyModal: ModalData = { title: '', date: '', time: '', type: '방문', customer_id: null, memo: '' };

const labelSt: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' };
const inputSt: React.CSSProperties = { width: '100%', height: '40px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '14px', outline: 'none', background: '#fff' };
const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' };

export default function SchedulePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [modalData, setModalData] = useState<ModalData>(emptyModal);
  const [holidays, setHolidays] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/schedule'); return; }
      setAuthChecked(true);
      fetchAll();
    });
  }, []);

  // 월 변경 시 공휴일 조회
  useEffect(() => {
    if (!authChecked) return;
    let cancelled = false;
    fetch(`/api/holidays?year=${year}&month=${month + 1}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        (data.holidays ?? []).forEach((h: { date: string; name: string }) => { map[h.date] = h.name; });
        setHolidays(map);
      })
      .catch(err => console.warn('[holidays]', err));
    return () => { cancelled = true; };
  }, [authChecked, year, month]);

  const fetchAll = async () => {
    const [schedRes, visitRes, allRes] = await Promise.all([
      supabase.from('schedules').select('*').order('schedule_date', { ascending: true }),
      supabase.from('customers').select('*').not('visit_date', 'is', null).in('status', ['방문예정', '방문완료']).order('visit_date', { ascending: true }),
      supabase.from('customers').select('id, name, phone').order('name', { ascending: true }),
    ]);
    setSchedules(schedRes.data ?? []);
    setCustomers(visitRes.data ?? []);
    setAllCustomers(allRes.data ?? []);
  };

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); setSelectedDate(null); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); setSelectedDate(null); };

  const days = getMonthDays(year, month);

  const getDateKey = (day: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };
  const toDateKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // 날짜별 병합
  const itemsByDate: Record<string, CalItem[]> = {};
  schedules.forEach(s => {
    if (!s.schedule_date) return;
    const key = toDateKey(s.schedule_date);
    const color = SCHEDULE_COLORS[(s.type as ScheduleType)] ?? '#888';
    (itemsByDate[key] ??= []).push({ key: `s-${s.id}`, source: 'schedule', color, label: s.title, iso: s.schedule_date, schedule: s });
  });
  customers.forEach(c => {
    if (!c.visit_date) return;
    const key = toDateKey(c.visit_date);
    const color = STATUS_COLORS[c.status ?? ''] ?? '#999';
    (itemsByDate[key] ??= []).push({ key: `c-${c.id}`, source: 'customer', color, label: c.name, iso: c.visit_date, customer: c });
  });
  // 날짜별 시간순 정렬
  Object.keys(itemsByDate).forEach(k => {
    itemsByDate[k].sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());
  });

  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const selectedItems = selectedDate ? (itemsByDate[selectedDate] ?? []) : [];

  const handleDayClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    openAddModal(dateKey);
  };

  const openAddModal = (dateKey: string) => {
    setModalMode('add');
    setModalData({ ...emptyModal, date: dateKey });
    setModalOpen(true);
  };

  const openEditModal = (s: ScheduleRow) => {
    const dt = new Date(s.schedule_date);
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    setModalMode('edit');
    setModalData({
      id: s.id,
      title: s.title ?? '',
      date: dateStr,
      time: isoToTimeString(s.schedule_date),
      type: (SCHEDULE_TYPES as readonly string[]).includes(s.type) ? (s.type as ScheduleType) : '기타',
      customer_id: s.customer_id,
      memo: s.memo ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const saveSchedule = async () => {
    if (!modalData.title.trim()) { alert('제목을 입력해주세요.'); return; }
    if (!modalData.date) { alert('날짜를 선택해주세요.'); return; }

    const { iso, error: timeErr } = combineDateTime(modalData.date, modalData.time);
    if (timeErr) { alert(`${timeErr}\n예) 14:00, 오후 2시, 오전 10시 30분`); return; }
    if (!iso) { alert('날짜를 다시 확인해주세요.'); return; }

    const payload = {
      title: modalData.title.trim(),
      schedule_date: iso,
      type: modalData.type,
      customer_id: modalData.customer_id,
      memo: modalData.memo.trim() || null,
    };
    if (modalMode === 'edit' && modalData.id) {
      const { error } = await supabase.from('schedules').update(payload).eq('id', modalData.id);
      if (error) { alert(`수정 실패: ${error.message}`); return; }
    } else {
      const { error } = await supabase.from('schedules').insert(payload);
      if (error) { alert(`저장 실패: ${error.message}`); return; }
    }
    closeModal();
    fetchAll();
  };

  const deleteSchedule = async () => {
    if (!modalData.id) return;
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('schedules').delete().eq('id', modalData.id);
    if (error) { alert(`삭제 실패: ${error.message}`); return; }
    closeModal();
    fetchAll();
  };

  const handleItemClick = (item: CalItem) => {
    if (item.source === 'schedule') openEditModal(item.schedule);
    else router.push(`/admin/customers/${item.customer.id}/edit`);
  };

  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>;

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a' }}>스케줄</h1>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => openAddModal(todayKey)} style={{ padding: '10px 16px', background: '#1a1a1a', color: '#e2a06e', border: '1px solid #333', borderRadius: '6px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>+ 일정 추가</button>
            <a href="/admin" style={{ padding: '10px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#666', textDecoration: 'none' }}>대시보드</a>
            <a href="/admin/customers" style={{ padding: '10px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#666', textDecoration: 'none' }}>손님 관리</a>
          </div>
        </div>

        {/* 범례 */}
        <div className="sched-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', marginBottom: '12px', padding: '10px 14px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '12px', color: '#555' }}>
          {SCHEDULE_TYPES.map(t => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: SCHEDULE_COLORS[t] }} />
              {t}
            </span>
          ))}
        </div>

        {/* 캘린더 */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#1a1a1a' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#e2a06e', fontSize: '20px', cursor: 'pointer', padding: '4px 12px' }}>&lsaquo;</button>
            <span className="sched-nav" style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{year}년 {month + 1}월</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#e2a06e', fontSize: '20px', cursor: 'pointer', padding: '4px 12px' }}>&rsaquo;</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e0e0e0' }}>
            {DAYS.map((d, i) => (
              <div key={d} style={{ padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: i === 0 ? '#e05050' : i === 6 ? '#4a80e8' : '#666' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {days.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} style={{ minHeight: '130px', borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }} />;
              const dateKey = getDateKey(day);
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDate;
              const dayItems = itemsByDate[dateKey] ?? [];
              const dayOfWeek = new Date(year, month, day).getDay();
              const holidayName = holidays[dateKey];
              const isHoliday = !!holidayName;
              const dayColor = isHoliday || dayOfWeek === 0 ? '#e05050' : dayOfWeek === 6 ? '#4a80e8' : '#333';

              return (
                <div
                  key={day}
                  onClick={() => handleDayClick(dateKey)}
                  className="sched-cal-day"
                  style={{
                    minHeight: '130px', padding: '8px', cursor: 'pointer',
                    borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0',
                    background: isSelected ? '#fff8f2' : isToday ? '#fffde7' : '#fff',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    fontSize: '15px', fontWeight: isToday ? 800 : 500, marginBottom: '4px',
                    color: dayColor,
                    display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
                  }}>
                    {isToday ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: '#e2a06e', color: '#fff', fontSize: '14px' }}>{day}</span>
                    ) : day}
                    {isHoliday && (
                      <span className="sched-holiday" style={{ fontSize: '10px', fontWeight: 600, color: '#e05050', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={holidayName}>
                        {holidayName}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {dayItems.slice(0, 4).map(item => {
                      const isCustomer = item.source === 'customer';
                      const typeLabel = isCustomer ? '방문' : item.schedule.type;
                      const badgeColor = isCustomer ? SCHEDULE_COLORS['방문'] : item.color;
                      const timeStr = isoToTimeString(item.iso);
                      const titleText = isCustomer ? `[방문] ${timeStr}` : `[${typeLabel}] ${timeStr} ${item.label}`;
                      return (
                        <div
                          key={item.key}
                          onClick={e => { e.stopPropagation(); handleItemClick(item); }}
                          className="sched-badge"
                          title={titleText}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', overflow: 'hidden', whiteSpace: 'nowrap', cursor: 'pointer', color: '#333' }}
                        >
                          <span style={{ background: badgeColor, color: '#fff', fontWeight: 700, fontSize: '10px', padding: '1px 5px', borderRadius: '3px', flexShrink: 0 }}>{typeLabel}</span>
                          {timeStr && <span style={{ color: '#888', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>}
                          {!isCustomer && (
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{item.label}</span>
                          )}
                        </div>
                      );
                    })}
                    {dayItems.length > 4 && (
                      <div style={{ fontSize: '11px', color: '#999', fontWeight: 600 }}>+{dayItems.length - 4}개</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 선택한 날짜 목록 */}
        {selectedDate && selectedItems.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e' }}>
              {selectedDate.replace(/-/g, '.')} 일정 ({selectedItems.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedItems.map(item => (
                <div key={item.key}
                  onClick={() => handleItemClick(item)}
                  className="sched-detail-row"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#fafafa', borderRadius: '6px', border: '1px solid #f0f0f0', flexWrap: 'wrap', gap: '8px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: item.color, color: '#fff', fontWeight: 600 }}>
                      {item.source === 'schedule' ? item.schedule.type : item.customer.status ?? '-'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{item.label}</span>
                    {item.source === 'customer' && (
                      <>
                        {item.customer.phone && <span style={{ fontSize: '13px', color: '#888' }}>{item.customer.phone}</span>}
                        {item.customer.interest_type && <span style={{ fontSize: '12px', color: '#666', background: '#f0f0f0', padding: '2px 8px', borderRadius: '4px' }}>{item.customer.interest_type}</span>}
                      </>
                    )}
                    {item.source === 'schedule' && item.schedule.memo && (
                      <span style={{ fontSize: '13px', color: '#666' }}>{item.schedule.memo}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '13px', color: '#888' }}>
                    {new Date(item.iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 모달 */}
      {modalOpen && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="sched-modal"
            style={{ background: '#fff', borderRadius: '10px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
          >
            <div style={{ padding: '16px 24px', background: '#1a1a1a', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#e2a06e' }}>
                {modalMode === 'edit' ? '일정 수정' : '일정 추가'}
              </h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: '#e2a06e', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelSt}>제목 *</label>
                <input
                  value={modalData.title}
                  onChange={e => setModalData({ ...modalData, title: e.target.value })}
                  placeholder="예) 홍길동 손님 방문"
                  style={inputSt}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelSt}>날짜 *</label>
                  <input type="date" value={modalData.date} onChange={e => setModalData({ ...modalData, date: e.target.value })} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>시간</label>
                  <input
                    type="text"
                    value={modalData.time}
                    onChange={e => setModalData({ ...modalData, time: e.target.value })}
                    placeholder="예) 14:00, 오후 2시, 오전 10시 30분"
                    style={inputSt}
                  />
                </div>
              </div>

              <div>
                <label style={labelSt}>종류</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {SCHEDULE_TYPES.map(t => {
                    const active = modalData.type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setModalData({ ...modalData, type: t })}
                        style={{
                          padding: '8px 16px', borderRadius: '20px',
                          border: `1px solid ${active ? SCHEDULE_COLORS[t] : '#ddd'}`,
                          background: active ? SCHEDULE_COLORS[t] : '#fff',
                          color: active ? '#fff' : '#555',
                          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        }}
                      >{t}</button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={labelSt}>손님 연결 (선택)</label>
                <select
                  value={modalData.customer_id ?? ''}
                  onChange={e => setModalData({ ...modalData, customer_id: e.target.value || null })}
                  style={selectSt}
                >
                  <option value="">— 연결 안 함 —</option>
                  {allCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelSt}>메모</label>
                <textarea
                  value={modalData.memo}
                  onChange={e => setModalData({ ...modalData, memo: e.target.value })}
                  placeholder="메모를 입력하세요"
                  rows={3}
                  style={{ ...inputSt, height: 'auto', padding: '10px 12px', resize: 'vertical', minHeight: '70px', lineHeight: 1.5 }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 24px 20px', display: 'flex', justifyContent: 'space-between', gap: '10px', borderTop: '1px solid #f0f0f0' }}>
              {modalMode === 'edit' ? (
                <button onClick={deleteSchedule} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #e05050', color: '#e05050', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>삭제</button>
              ) : <span />}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={closeModal} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #ddd', color: '#666', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
                <button onClick={saveSchedule} style={{ padding: '10px 20px', background: '#1a1a1a', border: '1px solid #1a1a1a', color: '#e2a06e', borderRadius: '6px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                  {modalMode === 'edit' ? '수정' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          main { padding: 12px 8px !important; }
          main h1 { font-size: 22px !important; }
          main > div > div:first-child { flex-direction: column !important; align-items: stretch !important; }
          .sched-cal-day { min-height: 100px !important; padding: 5px !important; }
          .sched-cal-day > div:first-child { font-size: 12px !important; }
          .sched-cal-day .sched-badge { font-size: 9px !important; padding: 1px 4px !important; }
          .sched-cal-day .sched-holiday { font-size: 9px !important; }
          .sched-nav span { font-size: 16px !important; }
          .sched-detail-row { flex-direction: column !important; align-items: flex-start !important; gap: 4px !important; padding: 10px 12px !important; }
          .sched-legend { gap: 8px !important; font-size: 11px !important; }
          .sched-modal { max-width: 100% !important; }
        }
        @media (min-width: 768px) and (max-width: 1199px) {
          .sched-cal-day { min-height: 120px !important; padding: 8px !important; }
        }
      ` }} />
    </main>
  );
}
