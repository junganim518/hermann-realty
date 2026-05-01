'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DesiredConditions } from '@/lib/matchProperties';
import { ALL_THEMES, getThemeIcon } from '@/lib/themeUtils';

const PROPERTY_TYPES = ['상가', '사무실', '오피스텔', '아파트', '건물', '기타'];
const TX_TYPES = ['월세', '전세', '매매'];

interface Props {
  value: DesiredConditions;
  onChange: (next: DesiredConditions) => void;
  defaultOpen?: boolean;
}

export default function CustomerConditionsForm({ value, onChange, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const set = <K extends keyof DesiredConditions>(key: K, v: DesiredConditions[K]) => {
    onChange({ ...value, [key]: v });
  };

  const toggleArrayValue = (key: 'property_types' | 'transaction_types' | 'desired_themes', item: string) => {
    const list = (value[key] ?? []) as string[];
    const next = list.includes(item) ? list.filter(x => x !== item) : [...list, item];
    set(key, next as any);
  };

  const setNumOrNull = (key: keyof DesiredConditions, raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) { set(key, null as any); return; }
    const n = parseFloat(trimmed);
    set(key, (isNaN(n) ? null : n) as any);
  };

  const labelSt: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '4px' };
  const inputSt: React.CSSProperties = { width: '100%', height: '36px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 10px', fontSize: '13px', outline: 'none', background: '#fff' };
  const sectionSt: React.CSSProperties = { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', marginBottom: '20px', overflow: 'hidden' };
  const sectionHeader: React.CSSProperties = { padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: open ? '2px solid #e2a06e' : 'none', userSelect: 'none' };
  const sectionTitle: React.CSSProperties = { fontSize: '17px', fontWeight: 700, color: '#1a1a1a' };
  const chipBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: active ? 700 : 500, cursor: 'pointer',
    background: active ? '#1a1a1a' : '#fff', color: active ? '#e2a06e' : '#666',
    border: active ? '1px solid #1a1a1a' : '1px solid #ddd',
  });

  const isMaeMaeSelected = (value.transaction_types ?? []).includes('매매');
  const isWolseSelected = (value.transaction_types ?? []).includes('월세');

  return (
    <div className="admin-section" style={sectionSt}>
      <div style={sectionHeader} onClick={() => setOpen(o => !o)}>
        <span style={sectionTitle}>🎯 원하는 매물 조건</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#888', fontSize: '12px' }}>
          {open ? '접기' : '펼치기'}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>
      {open && (
        <div style={{ padding: '20px' }}>
          {/* 매물종류 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelSt}>매물종류 (다중 선택)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PROPERTY_TYPES.map(t => {
                const active = (value.property_types ?? []).includes(t);
                return (
                  <button key={t} type="button" onClick={() => toggleArrayValue('property_types', t)} style={chipBtn(active)}>{t}</button>
                );
              })}
            </div>
          </div>

          {/* 거래유형 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelSt}>거래유형 (다중 선택)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {TX_TYPES.map(t => {
                const active = (value.transaction_types ?? []).includes(t);
                return (
                  <button key={t} type="button" onClick={() => toggleArrayValue('transaction_types', t)} style={chipBtn(active)}>{t}</button>
                );
              })}
            </div>
          </div>

          {/* 보증금 / 월세 / 매매가 / 면적 / 층수 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelSt}>보증금 (만원)</label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="number" value={value.deposit_min ?? ''} onChange={e => setNumOrNull('deposit_min', e.target.value)} placeholder="최소" style={inputSt} />
                <span style={{ color: '#888' }}>~</span>
                <input type="number" value={value.deposit_max ?? ''} onChange={e => setNumOrNull('deposit_max', e.target.value)} placeholder="최대" style={inputSt} />
              </div>
            </div>
            <div>
              <label style={labelSt}>월세 (만원) {!isWolseSelected && <span style={{ color: '#aaa', fontWeight: 400 }}>· 거래유형 월세 선택 시 적용</span>}</label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="number" value={value.monthly_rent_min ?? ''} onChange={e => setNumOrNull('monthly_rent_min', e.target.value)} placeholder="최소" style={inputSt} />
                <span style={{ color: '#888' }}>~</span>
                <input type="number" value={value.monthly_rent_max ?? ''} onChange={e => setNumOrNull('monthly_rent_max', e.target.value)} placeholder="최대" style={inputSt} />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', opacity: isMaeMaeSelected ? 1 : 0.6 }}>
              <label style={labelSt}>매매가 (만원) {!isMaeMaeSelected && <span style={{ color: '#aaa', fontWeight: 400 }}>· 거래유형 매매 선택 시 활성화</span>}</label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', maxWidth: '100%' }}>
                <input type="number" value={value.sale_price_min ?? ''} onChange={e => setNumOrNull('sale_price_min', e.target.value)} placeholder="최소" style={inputSt} disabled={!isMaeMaeSelected} />
                <span style={{ color: '#888' }}>~</span>
                <input type="number" value={value.sale_price_max ?? ''} onChange={e => setNumOrNull('sale_price_max', e.target.value)} placeholder="최대" style={inputSt} disabled={!isMaeMaeSelected} />
              </div>
            </div>

            <div>
              <label style={labelSt}>전용 면적 (평)</label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="number" value={value.area_min ?? ''} onChange={e => setNumOrNull('area_min', e.target.value)} placeholder="최소" style={inputSt} />
                <span style={{ color: '#888' }}>~</span>
                <input type="number" value={value.area_max ?? ''} onChange={e => setNumOrNull('area_max', e.target.value)} placeholder="최대" style={inputSt} />
              </div>
            </div>
            <div>
              <label style={labelSt}>층수</label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="number" value={value.floor_min ?? ''} onChange={e => setNumOrNull('floor_min', e.target.value)} placeholder="최소" style={inputSt} />
                <span style={{ color: '#888' }}>~</span>
                <input type="number" value={value.floor_max ?? ''} onChange={e => setNumOrNull('floor_max', e.target.value)} placeholder="최대" style={inputSt} />
              </div>
            </div>
          </div>

          {/* 지역 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelSt}>지역</label>
            <input
              value={value.region ?? ''}
              onChange={e => set('region', e.target.value)}
              placeholder='예: "중동", "원미구"'
              style={inputSt}
            />
          </div>

          {/* 무권리 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '13px', color: '#333', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={!!value.no_premium}
                onChange={e => set('no_premium', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              무권리 매물 원함
            </label>
          </div>

          {/* 원하는 테마 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelSt}>
              원하는 테마 <span style={{ color: '#aaa', fontWeight: 400 }}>(다중 선택 — 1개라도 일치하면 매칭 점수 가산)</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {ALL_THEMES.map(t => {
                const active = (value.desired_themes ?? []).includes(t);
                const icon = getThemeIcon(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleArrayValue('desired_themes', t)}
                    style={chipBtn(active)}
                  >
                    {icon ? `${icon} ${t}` : t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 추가 메모 */}
          <div>
            <label style={labelSt}>추가 메모</label>
            <textarea
              value={value.additional_memo ?? ''}
              onChange={e => set('additional_memo', e.target.value)}
              placeholder="예: 역세권 우선, 주차 가능, 1층 선호"
              rows={3}
              style={{ width: '100%', border: '1px solid #ddd', borderRadius: '6px', padding: '10px', fontSize: '13px', outline: 'none', resize: 'vertical', background: '#fff' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
