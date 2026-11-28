'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { triggerPrecentRevalidate } from '@/lib/triggerPrecentRevalidate';
import OfficetelPhotos from './OfficetelPhotos';
import { isMissingColumnError } from '@/lib/precentOfficetelTags';

type PageRow = {
  id: number;
  published: boolean;
  title: string | null;
  summary_text: string | null;
  unit_type: string | null;
  price_text: string | null;
  area_text: string | null;
  floors_text: string | null;
  rooms_text: string | null;
  move_in_text: string | null;
  options_text: string | null;
  parking_text: string | null;
  maintenance_fee_text: string | null;
  approval_date_text: string | null;
  guarantee_title: string | null;
  guarantee_detail: string | null;
  location_text: string | null;
  building_text: string | null;
  target_text: string | null;
  intro_text: string | null;
  complex_text?: string | null;
  items_text?: string | null;
  faq_text?: string | null;
  stats_text?: string | null;
  updated_at: string;
};

const REQUIRED_CHECK_FIELDS: { key: keyof PageRow; label: string }[] = [
  { key: 'move_in_text', label: '입주 가능일' },
  { key: 'parking_text', label: '주차' },
  { key: 'rooms_text', label: '방·욕실 수' },
  { key: 'maintenance_fee_text', label: '관리비' },
  { key: 'approval_date_text', label: '사용승인일' },
];

const EXTRA_INFO_FIELDS: (keyof PageRow)[] = ['rooms_text', 'maintenance_fee_text', 'approval_date_text'];

// ── 입력칸 공용 컴포넌트 — app/admin/precent-units/page.tsx의 AutoField와 같은 동작 ──
// 포커스 시점 값(baseline)과 다를 때만 blur/Enter에서 commit 호출, Esc는 원래 값으로 되돌리고 커밋 안 함.
// commit이 true를 반환하면 1.5초간 ✓ 표시. autoGrow=true면 줄바꿈되는 자동 높이 textarea(Shift+Enter=줄바꿈).
function AutoField({
  value, commit, placeholder, autoGrow,
}: {
  value: string;
  commit: (v: string) => Promise<boolean>;
  placeholder?: string;
  autoGrow?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [baseline, setBaseline] = useState('');
  const [flash, setFlash] = useState(false);
  const cancellingRef = useRef(false);
  const elRef = useRef<HTMLTextAreaElement | null>(null);

  const shown = draft ?? value;

  useEffect(() => {
    if (!autoGrow || !elRef.current) return;
    const el = elRef.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [autoGrow, shown]);

  const handleFocus = () => {
    if (draft !== null) return;
    setDraft(value);
    setBaseline(value);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft(e.target.value);
  };

  const handleBlur = async () => {
    if (cancellingRef.current) { cancellingRef.current = false; setDraft(null); return; }
    if (draft === null) return;
    const v = draft;
    setDraft(null);
    if (v === baseline) return; // 값이 바뀌지 않았으면 저장하지 않음
    const ok = await commit(v);
    if (ok) {
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      cancellingRef.current = true;
      setDraft(null);
      (e.target as HTMLElement).blur();
      return;
    }
    if (e.key !== 'Enter') return;
    if (autoGrow) return; // 여러 줄 입력은 Enter = 줄바꿈, blur로만 저장
    e.preventDefault();
    (e.target as HTMLElement).blur(); // Enter = 저장 (한 줄 입력)
  };

  const Tag: any = autoGrow ? 'textarea' : 'input';

  return (
    <span style={{ position: 'relative', display: 'block', width: '100%' }}>
      <Tag
        ref={elRef}
        className="po-field"
        value={shown}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={autoGrow ? 2 : undefined}
        style={{
          width: '100%',
          borderRadius: '6px',
          padding: autoGrow ? '8px 10px' : '0 10px',
          outline: 'none',
          background: '#fff',
          color: '#1a1a1a',
          boxSizing: 'border-box',
          display: 'block',
          lineHeight: autoGrow ? 1.5 : undefined,
          resize: autoGrow ? 'none' : undefined,
          overflow: 'hidden',
          whiteSpace: autoGrow ? 'pre-wrap' : undefined,
        } as React.CSSProperties}
      />
      {flash && (
        <span style={{ position: 'absolute', right: '-18px', top: autoGrow ? '8px' : '50%', transform: autoGrow ? undefined : 'translateY(-50%)', color: '#16a34a', fontSize: '14px', fontWeight: 700, pointerEvents: 'none' }}>✓</span>
      )}
    </span>
  );
}

function FormRow({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '3px' }}>{label}</div>
      {help && <div style={{ fontSize: '11px', color: '#999', marginBottom: '5px' }}>{help}</div>}
      {children}
    </div>
  );
}

function Section({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '18px 20px', marginBottom: '16px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 2px' }}>{title}</h2>
      {help && <p style={{ fontSize: '12px', color: '#999', margin: '0 0 14px' }}>{help}</p>}
      {!help && <div style={{ marginBottom: '10px' }} />}
      {children}
    </div>
  );
}

export default function PrecentOfficetelAdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [page, setPage] = useState<PageRow | null>(null);
  const [rowMissing, setRowMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingPublish, setSavingPublish] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const extraInitRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return; }
      setAuthChecked(true);
    });
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    supabase.from('precent_officetel_page').select('*').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) { setErrorMsg(`불러오기 실패: ${error.message}`); setLoading(false); return; }
      if (!data) { setRowMissing(true); setLoading(false); return; }
      const row = data as PageRow;
      setPage(row);
      if (!extraInitRef.current) {
        extraInitRef.current = true;
        setExtraOpen(EXTRA_INFO_FIELDS.some(f => !!row[f]));
      }
      setLoading(false);
    });
  }, [authChecked]);

  const saveField = async (field: keyof PageRow, raw: string): Promise<boolean> => {
    if (!page) return false;
    const value = raw.trim() || null;
    if (value === (page[field] ?? null)) return false;
    const { error } = await supabase
      .from('precent_officetel_page')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) {
      setErrorMsg(isMissingColumnError(error) ? 'SQL 적용이 필요합니다 (precent_officetel_media.sql 실행 후 다시 시도하세요)' : `저장 실패: ${error.message}`);
      return false;
    }
    setPage(prev => prev ? { ...prev, [field]: value, updated_at: new Date().toISOString() } as PageRow : prev);
    triggerPrecentRevalidate('/properties/boramae-precent-officetel');
    return true;
  };

  const commitField = (field: keyof PageRow) => (raw: string) => saveField(field, raw);

  const handleTogglePublished = async () => {
    if (!page) return;
    const next = !page.published;
    let msg = next
      ? '게시하면 방문자와 검색엔진에 공개됩니다. 2년 임대료 보장 조건이 계약서 기준으로 확인되었나요?'
      : '비공개로 전환하면 방문자 페이지에 더 이상 공개되지 않습니다. 계속할까요?';
    if (next && page.guarantee_title && !page.guarantee_detail) {
      msg += '\n\n⚠ 수익보장 상세 조건이 비어 있습니다.';
    }
    if (!window.confirm(msg)) return;

    setSavingPublish(true);
    const { error } = await supabase
      .from('precent_officetel_page')
      .update({ published: next, updated_at: new Date().toISOString() })
      .eq('id', 1);
    setSavingPublish(false);
    if (error) { setErrorMsg(`게시 상태 저장 실패: ${error.message}`); return; }
    setPage(prev => prev ? { ...prev, published: next } : prev);
    // 상가 페이지의 "오피스텔 특별분양 보기" 링크 노출 여부도 게시 전환에 맞춰 즉시 갱신되어야 함
    triggerPrecentRevalidate('/properties/boramae-precent-officetel');
    triggerPrecentRevalidate('/properties/boramae-precent');
  };

  if (!authChecked) return null;

  const missingRequired = page ? REQUIRED_CHECK_FIELDS.filter(f => !page[f.key]) : [];

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', padding: '24px 16px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .po-field { border: 1px solid #e3e3e3; transition: border-color 0.15s, background 0.15s; height: 36px; font-size: 14px; }
        .po-field[rows] { height: auto; }
        .po-field:hover { border-color: #bbb; }
        .po-field:focus { border-color: #c47c30; background: #fffdf8; }
        .po-field::placeholder { color: #bbb; }
      ` }} />
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <a href="/admin" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>← 관리자 홈</a>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1a1a1a', margin: '4px 0 0' }}>
              프리센트 오피스텔 특별분양 관리
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            <a href="/admin/precent-officetel/preview" target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#888', textDecoration: 'none', fontWeight: 600 }}>
              미리보기 →
            </a>
            <a href="/properties/boramae-precent-officetel" target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#c47c30', textDecoration: 'none', fontWeight: 600 }}>
              방문자 페이지 보기 →
            </a>
          </div>
        </div>

        {errorMsg && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', lineHeight: 1.5, display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>✕</button>
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: 'center', color: '#aaa', padding: '40px' }}>불러오는 중...</p>
        ) : rowMissing || !page ? (
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '40px 20px', textAlign: 'center', color: '#888', fontSize: '14px' }}>
            초기 데이터가 없습니다. SQL을 먼저 실행하세요.
          </div>
        ) : (
          <>
            {missingRequired.length > 0 && (
              <div style={{ fontSize: '12px', color: '#999', background: '#f8f8f8', border: '1px solid #eee', borderRadius: '6px', padding: '8px 12px', marginBottom: '14px' }}>
                참고: 비어 있는 항목 — {missingRequired.map(f => f.label).join(', ')}
              </div>
            )}

            {/* 게시 스위치 */}
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                onClick={handleTogglePublished}
                disabled={savingPublish}
                role="switch"
                aria-checked={page.published}
                style={{
                  width: '52px', height: '28px', borderRadius: '14px', border: 'none', cursor: savingPublish ? 'default' : 'pointer',
                  background: page.published ? '#16a34a' : '#ccc', position: 'relative', transition: 'background 0.15s', flexShrink: 0,
                  opacity: savingPublish ? 0.6 : 1,
                }}
              >
                <span style={{
                  position: 'absolute', top: '3px', left: page.published ? '27px' : '3px', width: '22px', height: '22px',
                  borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: page.published ? '#16a34a' : '#666' }}>
                  {page.published ? '게시 중 — 방문자와 검색엔진에 공개됩니다' : '비공개 — 방문자에게 보이지 않습니다'}
                </div>
              </div>
            </div>

            <Section title="기본 정보">
              <FormRow label="페이지 제목">
                <AutoField value={page.title ?? ''} commit={commitField('title')} placeholder="미입력" />
              </FormRow>
              <FormRow label="핵심 한 줄 요약">
                <AutoField value={page.summary_text ?? ''} commit={commitField('summary_text')} placeholder="미입력" />
              </FormRow>
              <FormRow label="타입">
                <AutoField value={page.unit_type ?? ''} commit={commitField('unit_type')} placeholder="예: O타입 투룸" />
              </FormRow>
              <FormRow label="분양가 표시 문구" help="예: 4억 초중반대">
                <AutoField value={page.price_text ?? ''} commit={commitField('price_text')} placeholder="미입력" />
              </FormRow>
              <FormRow label="전용면적">
                <AutoField value={page.area_text ?? ''} commit={commitField('area_text')} placeholder="미입력" />
              </FormRow>
              <FormRow label="입주 가능일">
                <AutoField value={page.move_in_text ?? ''} commit={commitField('move_in_text')} placeholder="미입력" />
              </FormRow>
              <FormRow label="옵션">
                <AutoField value={page.options_text ?? ''} commit={commitField('options_text')} placeholder="미입력" />
              </FormRow>
              <FormRow label="주차">
                <AutoField value={page.parking_text ?? ''} commit={commitField('parking_text')} placeholder="미입력" />
              </FormRow>

              <button
                onClick={() => setExtraOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#888', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '4px 0', marginTop: '4px' }}
              >
                <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: extraOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
                추가 정보 (선택 — 비어 있으면 페이지에 표시되지 않습니다)
              </button>
              {extraOpen && (
                <div style={{ marginTop: '12px', paddingLeft: '14px', borderLeft: '2px solid #eee' }}>
                  <FormRow label="방·욕실 수 / 구조">
                    <AutoField value={page.rooms_text ?? ''} commit={commitField('rooms_text')} placeholder="미입력" />
                  </FormRow>
                  <FormRow label="관리비">
                    <AutoField value={page.maintenance_fee_text ?? ''} commit={commitField('maintenance_fee_text')} placeholder="미입력" />
                  </FormRow>
                  <FormRow label="사용승인일">
                    <AutoField value={page.approval_date_text ?? ''} commit={commitField('approval_date_text')} placeholder="미입력" />
                  </FormRow>
                </div>
              )}
            </Section>

            <Section title="숫자 띠" help="한 줄에 하나씩 '값 | 설명' 형식으로 적으세요. 예) 약 150m | 보라매역까지 — 비어 있으면 방문자 페이지에서 이 섹션이 숨겨집니다.">
              <AutoField value={page.stats_text ?? ''} commit={commitField('stats_text')} placeholder="미입력" autoGrow />
            </Section>

            <Section title="수익보장">
              <FormRow label="제목">
                <AutoField value={page.guarantee_title ?? ''} commit={commitField('guarantee_title')} placeholder="예: 2년 임대료 보장" />
              </FormRow>
              <FormRow label="상세 조건" help="보장 주체(시행사 등), 금액 또는 수익률, 기간, 적용 조건을 계약서 기준으로 적어주세요">
                <AutoField value={page.guarantee_detail ?? ''} commit={commitField('guarantee_detail')} placeholder="미입력" autoGrow />
              </FormRow>
            </Section>

            <Section title="단지 개요" help="한 줄에 하나씩 '항목: 내용' 형식으로 적으세요. 예) 규모: 지하 4층 ~ 지상 20층 — 비어 있으면 방문자 페이지에서 이 섹션이 숨겨집니다.">
              <AutoField value={page.complex_text ?? ''} commit={commitField('complex_text')} placeholder="미입력" autoGrow />
            </Section>

            <Section title="기본 제공 품목" help="한 줄에 하나씩 적으세요 — 비어 있으면 방문자 페이지에서 이 섹션이 숨겨집니다.">
              <AutoField value={page.items_text ?? ''} commit={commitField('items_text')} placeholder="미입력" autoGrow />
            </Section>

            <Section title="입지·교통" help="한 줄에 항목 하나씩">
              <AutoField value={page.location_text ?? ''} commit={commitField('location_text')} placeholder="미입력" autoGrow />
            </Section>

            <Section title="건물·주거 특징">
              <AutoField value={page.building_text ?? ''} commit={commitField('building_text')} placeholder="미입력" autoGrow />
            </Section>

            <Section title="이런 분께 추천">
              <AutoField value={page.target_text ?? ''} commit={commitField('target_text')} placeholder="미입력" autoGrow />
            </Section>

            <Section title="자주 묻는 질문" help="질문 한 줄, 답 한 줄 이상을 한 묶음으로 쓰고, 묶음 사이는 빈 줄로 구분하세요 — 비어 있으면 방문자 페이지에서 이 섹션이 숨겨집니다.">
              <AutoField value={page.faq_text ?? ''} commit={commitField('faq_text')} placeholder="미입력" autoGrow />
            </Section>

            <Section title="추가 소개">
              <AutoField value={page.intro_text ?? ''} commit={commitField('intro_text')} placeholder="미입력" autoGrow />
            </Section>

            <Section title="사진 관리">
              <OfficetelPhotos onError={setErrorMsg} />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
