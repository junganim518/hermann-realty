'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const STATUS_COLORS: Record<string, string> = {
  '상담중': '#2196F3', '방문예정': '#e2a06e', '방문완료': '#4caf50',
  '계약진행': '#ff9800', '계약완료': '#9c27b0', '보류': '#999',
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

export default function SchedulePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/schedule'); return; }
      setAuthChecked(true);
      fetchCustomers();
    });
  }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .not('visit_date', 'is', null)
      .order('visit_date', { ascending: true });
    setCustomers(data ?? []);
  };

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); setSelectedDate(null); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); setSelectedDate(null); };

  const days = getMonthDays(year, month);

  const getDateKey = (day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const customersByDate: Record<string, any[]> = {};
  customers.forEach(c => {
    if (!c.visit_date) return;
    const key = new Date(c.visit_date).toISOString().slice(0, 10);
    if (!customersByDate[key]) customersByDate[key] = [];
    customersByDate[key].push(c);
  });

  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const selectedCustomers = selectedDate ? (customersByDate[selectedDate] ?? []) : [];

  if (!authChecked) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩 중...</div>;

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a' }}>스케줄</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/admin" style={{ padding: '10px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#666', textDecoration: 'none' }}>대시보드</a>
            <a href="/admin/customers" style={{ padding: '10px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', color: '#666', textDecoration: 'none' }}>손님 관리</a>
          </div>
        </div>

        {/* 캘린더 */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
          {/* 월 네비게이션 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#1a1a1a' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#e2a06e', fontSize: '20px', cursor: 'pointer', padding: '4px 12px' }}>&lsaquo;</button>
            <span className="sched-nav" style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{year}년 {month + 1}월</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#e2a06e', fontSize: '20px', cursor: 'pointer', padding: '4px 12px' }}>&rsaquo;</button>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e0e0e0' }}>
            {DAYS.map((d, i) => (
              <div key={d} style={{ padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: i === 0 ? '#e05050' : i === 6 ? '#4a80e8' : '#666' }}>{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {days.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} style={{ minHeight: '80px', borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }} />;
              const dateKey = getDateKey(day);
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDate;
              const dayCustomers = customersByDate[dateKey] ?? [];
              const dayOfWeek = new Date(year, month, day).getDay();

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                  className="sched-cal-day"
                  style={{
                    minHeight: '80px', padding: '6px', cursor: 'pointer',
                    borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0',
                    background: isSelected ? '#fff8f2' : isToday ? '#fffde7' : '#fff',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    fontSize: '13px', fontWeight: isToday ? 800 : 400, marginBottom: '4px',
                    color: dayOfWeek === 0 ? '#e05050' : dayOfWeek === 6 ? '#4a80e8' : '#333',
                  }}>
                    {isToday ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: '#e2a06e', color: '#fff', fontSize: '12px' }}>{day}</span>
                    ) : day}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {dayCustomers.slice(0, 3).map(c => (
                      <div key={c.id} className="sched-badge" style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', background: STATUS_COLORS[c.status] ?? '#999', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </div>
                    ))}
                    {dayCustomers.length > 3 && (
                      <div style={{ fontSize: '10px', color: '#999' }}>+{dayCustomers.length - 3}명</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 선택한 날짜 손님 목록 */}
        {selectedDate && (
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e2a06e' }}>
              {selectedDate.replace(/-/g, '.')} 방문 손님 ({selectedCustomers.length}명)
            </h2>
            {selectedCustomers.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>해당 날짜에 방문 예정 손님이 없습니다</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedCustomers.map(c => (
                  <div key={c.id} className="sched-detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#fafafa', borderRadius: '6px', border: '1px solid #f0f0f0', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '15px' }}>{c.name}</span>
                      <span style={{ fontSize: '13px', color: '#888' }}>{c.phone || ''}</span>
                      {c.interest_type && <span style={{ fontSize: '12px', color: '#666', background: '#f0f0f0', padding: '2px 8px', borderRadius: '4px' }}>{c.interest_type}</span>}
                      {c.region && <span style={{ fontSize: '12px', color: '#666' }}>{c.region}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '13px', color: '#888' }}>
                        {c.visit_date ? new Date(c.visit_date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: STATUS_COLORS[c.status] ?? '#999', color: '#fff', fontWeight: 600 }}>{c.status}</span>
                      <a href={`/admin/customers/${c.id}/edit`} style={{ fontSize: '12px', color: '#e2a06e', textDecoration: 'none', fontWeight: 600 }}>수정</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          main { padding: 12px 8px !important; }
          main h1 { font-size: 22px !important; }
          main > div > div:first-child { flex-direction: column !important; }
          .sched-cal-day { min-height: 60px !important; padding: 4px !important; }
          .sched-cal-day > div:first-child { font-size: 11px !important; }
          .sched-cal-day .sched-badge { font-size: 8px !important; padding: 0 3px !important; }
          .sched-nav span { font-size: 16px !important; }
          .sched-detail-row { flex-direction: column !important; gap: 4px !important; padding: 10px 12px !important; }
        }
        @media (min-width: 768px) and (max-width: 1199px) {
          .sched-cal-day { min-height: 100px !important; padding: 8px !important; }
        }
      ` }} />
    </main>
  );
}
