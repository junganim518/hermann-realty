import { Phone, MapPin, Check } from 'lucide-react';
import Gallery, { type GalleryItem } from '../boramae-precent/Gallery';
import OfficetelInquiryForm from './OfficetelInquiryForm';

// select('*')로 읽으므로(아래 "SQL 실행 전에도 정상 동작" 참고) 모든 필드를 optional로 둔다 —
// DB에 아직 없는 컬럼(complex_text/items_text/faq_text)은 그냥 undefined로 들어오고, 그 경우
// 해당 섹션만 조용히 숨겨진다(에러 없음).
export type OfficetelPageData = {
  title?: string | null;
  summary_text?: string | null;
  unit_type?: string | null;
  price_text?: string | null;
  area_text?: string | null;
  rooms_text?: string | null;
  move_in_text?: string | null;
  options_text?: string | null;
  parking_text?: string | null;
  maintenance_fee_text?: string | null;
  approval_date_text?: string | null;
  guarantee_title?: string | null;
  guarantee_detail?: string | null;
  location_text?: string | null;
  building_text?: string | null;
  target_text?: string | null;
  intro_text?: string | null;
  complex_text?: string | null;
  items_text?: string | null;
  faq_text?: string | null;
};

export type OfficetelPhoto = { id: string; url: string; sort_order: number };

// 여러 줄 텍스트(한 줄에 항목 하나씩) → 체크 아이콘 목록용 배열. 빈 줄/공백 줄은 제거.
export function splitLines(text?: string | null): string[] {
  if (!text) return [];
  return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

export type OverviewRow = { label: string | null; value: string };

// "항목: 내용" 한 줄씩 → {label, value} 배열. ':' 가 없거나 라벨/내용 중 하나가 비면
// label을 null로 두어 한 줄 전체를 value로만 보여준다(안전한 예외 처리).
export function parseOverviewRows(text?: string | null): OverviewRow[] {
  return splitLines(text).map(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return { label: null, value: line };
    const label = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!label || !value) return { label: null, value: line };
    return { label, value };
  });
}

export type FaqItem = { question: string; answer: string };

// 빈 줄로 묶음을 나누고, 묶음의 첫 줄을 질문, 나머지 줄을 답으로 삼는다.
// 질문만 있고 답이 없는(비정상) 묶음은 건너뛴다 — 화면/JSON-LD 모두 같은 함수를 써서 항상 일치시킴.
export function parseFaq(text?: string | null): FaqItem[] {
  if (!text) return [];
  const blocks = text.split(/\r?\n[ \t]*\r?\n/);
  const result: FaqItem[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const [question, ...rest] = lines;
    result.push({ question, answer: rest.join('\n') });
  }
  return result;
}

const PAGE_CSS = `
  .of-wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 24px; box-sizing: border-box; }
  .of-hero-split { display: grid; grid-template-columns: 55fr 45fr; max-width: 1200px; margin: 0 auto; min-height: 380px; }
  .of-hero-left { padding: 52px 52px 52px 24px; display: flex; flex-direction: column; justify-content: center; }
  .of-hero-right { position: relative; overflow: hidden; }
  .of-hero-right img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
  .of-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to right, rgba(10,10,30,0.8) 0%, rgba(10,10,30,0.2) 60%, transparent 100%); pointer-events: none; }
  .of-badge { display: inline-block; background: rgba(196,124,48,0.18); border: 1px solid rgba(196,124,48,0.4); color: #e2a06e; font-size: 11px; font-weight: 700; letter-spacing: 2.5px; padding: 5px 16px; border-radius: 20px; margin-bottom: 22px; width: fit-content; }
  .of-spec-row { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0 28px; }
  .of-spec-chip { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); color: #ddd; font-size: 13px; font-weight: 600; padding: 7px 16px; border-radius: 20px; }
  .of-cta-group { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .of-cta-btn { display: inline-flex; align-items: center; gap: 8px; background: #c47c30; color: #fff; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 4px; text-decoration: none; transition: background 0.15s; white-space: nowrap; }
  .of-cta-btn:hover { background: #a8642a; }
  .of-cta-outline { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: rgba(255,255,255,0.85); border: 1px solid rgba(255,255,255,0.35); font-size: 15px; font-weight: 600; padding: 14px 26px; border-radius: 4px; text-decoration: none; transition: border-color 0.15s, color 0.15s; white-space: nowrap; }
  .of-cta-outline:hover { border-color: #c47c30; color: #c47c30; }
  .of-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .of-info-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; padding: 18px 20px; }
  .of-list { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
  .of-list-item { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: #444; line-height: 1.6; }
  .of-items-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 24px; }
  .of-overview-table { display: flex; flex-direction: column; }
  .of-overview-row { display: grid; grid-template-columns: 130px 1fr; gap: 12px; padding: 12px 0; border-bottom: 1px solid #eee; }
  .of-overview-row.full { grid-template-columns: 1fr; }
  .of-overview-row:last-child { border-bottom: none; }
  .of-overview-label { font-size: 13px; font-weight: 700; color: #888; }
  .of-overview-value { font-size: 14px; color: #333; line-height: 1.7; }
  .of-faq-item { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; margin-bottom: 10px; }
  .of-faq-q { display: flex; align-items: center; gap: 12px; padding: 16px 18px; cursor: pointer; font-size: 15px; font-weight: 700; color: #1a1a1a; list-style: none; }
  .of-faq-q::-webkit-details-marker { display: none; }
  .of-faq-q-badge { flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: #c47c30; color: #fff; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .of-faq-q-text { flex: 1; }
  .of-faq-q-toggle { flex-shrink: 0; font-size: 20px; font-weight: 300; color: #c47c30; transition: transform 0.15s; }
  .of-faq-item[open] .of-faq-q-toggle { transform: rotate(45deg); }
  .of-faq-a { padding: 0 18px 18px 54px; font-size: 14px; color: #555; line-height: 1.8; white-space: pre-line; }
  .of-inquiry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
  @media (max-width: 1023px) {
    .of-info-grid { grid-template-columns: repeat(2, 1fr); }
    .of-inquiry-grid { grid-template-columns: 1fr; gap: 32px; }
  }
  @media (max-width: 767px) {
    .of-hero-split { grid-template-columns: 1fr; min-height: auto; }
    .of-hero-right { height: 220px; order: -1; }
    .of-hero-overlay { background: rgba(0,0,0,0.25); }
    .of-hero-left { padding: 36px 20px 44px; }
    .of-cta-group { flex-direction: column; }
    .of-cta-btn, .of-cta-outline { display: flex; justify-content: center; width: 100%; box-sizing: border-box; }
    .of-info-grid { grid-template-columns: 1fr; gap: 12px; }
    .of-items-grid { grid-template-columns: 1fr; }
    .of-wrap { padding: 0 16px; }
  }
  @media (max-width: 480px) {
    .of-overview-row:not(.full) { grid-template-columns: 1fr; gap: 3px; padding: 10px 0; }
    .of-faq-a { padding-left: 18px; }
  }
`;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '11px', color: '#c47c30', fontWeight: 700, letterSpacing: '2px', textAlign: 'center', margin: '0 0 8px', textTransform: 'uppercase' }}>
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ textAlign: 'center', fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 800, color: '#1a1a1a', margin: '0 0 10px' }}>
      {children}
    </h2>
  );
}

function CheckList({ lines }: { lines: string[] }) {
  return (
    <ul className="of-list">
      {lines.map((line, i) => (
        <li key={i} className="of-list-item">
          <Check size={18} color="#c47c30" strokeWidth={2.4} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

export default function OfficetelLanding({ data, photos }: { data: OfficetelPageData; photos: OfficetelPhoto[] }) {
  const galleryItems: GalleryItem[] = photos.map(p => ({ id: p.id, url: p.url, caption: null, category: null, sort_order: p.sort_order }));
  const heroPhoto = photos[0] ?? null;

  const heroBadges = [data.price_text, data.guarantee_title].filter(Boolean) as string[];

  const infoItems = ([
    data.unit_type && { label: '타입', value: data.unit_type },
    data.area_text && { label: '전용면적', value: data.area_text },
    data.price_text && { label: '분양가', value: data.price_text },
    data.move_in_text && { label: '입주 가능일', value: data.move_in_text },
    data.options_text && { label: '옵션', value: data.options_text },
    data.parking_text && { label: '주차', value: data.parking_text },
    data.rooms_text && { label: '방·욕실', value: data.rooms_text },
    data.maintenance_fee_text && { label: '관리비', value: data.maintenance_fee_text },
    data.approval_date_text && { label: '사용승인일', value: data.approval_date_text },
  ].filter(Boolean)) as { label: string; value: string }[];

  const overviewRows = parseOverviewRows(data.complex_text);
  const itemLines = splitLines(data.items_text);
  const locationLines = splitLines(data.location_text);
  const buildingLines = splitLines(data.building_text);
  const targetLines = splitLines(data.target_text);
  const faqItems = parseFaq(data.faq_text);

  const title = data.title ?? '프리센트 오피스텔 특별분양';

  return (
    <main style={{ minHeight: '100vh', background: '#fafafa' }}>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

      {/* ── 히어로 ── */}
      <section style={{ background: '#0a0a1e', color: '#fff' }}>
        <div className="of-hero-split">
          <div className="of-hero-left">
            <div className="of-badge">BORAMAE · OFFICETEL · 특별분양</div>
            <h1 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 900, lineHeight: 1.25, margin: '0 0 14px', letterSpacing: '-0.5px' }}>
              {title}
            </h1>
            {data.summary_text && (
              <p style={{ fontSize: 'clamp(13px, 1.6vw, 16px)', color: '#aaa', lineHeight: 1.8, margin: 0 }}>
                {data.summary_text}
              </p>
            )}
            {heroBadges.length > 0 && (
              <div className="of-spec-row">
                {heroBadges.map(b => <span key={b} className="of-spec-chip">{b}</span>)}
              </div>
            )}
            <div className="of-cta-group" style={{ marginTop: '28px' }}>
              <a href="tel:01086808151" className="of-cta-btn">
                <Phone size={15} strokeWidth={2} />
                전화 상담
              </a>
              <a href="#officetel-inquiry" className="of-cta-outline">
                문의하기
              </a>
            </div>
          </div>
          {heroPhoto && (
            <div className="of-hero-right">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroPhoto.url} alt={title} />
              <div className="of-hero-overlay" />
            </div>
          )}
        </div>
      </section>

      {/* ── 핵심 정보 ── */}
      {infoItems.length > 0 && (
        <section style={{ padding: '64px 0 72px', background: '#f4f4f4' }}>
          <div className="of-wrap">
            <SectionLabel>Overview</SectionLabel>
            <SectionTitle>핵심 정보</SectionTitle>
            <div className="of-info-grid" style={{ marginTop: '28px' }}>
              {infoItems.map(item => (
                <div key={item.label} className="of-info-card">
                  <div style={{ fontSize: '11px', color: '#999', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '6px' }}>{item.label}</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a1a', lineHeight: 1.4 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 특별 혜택(수익보장) ── */}
      {data.guarantee_title && (
        <section style={{ padding: '64px 0 72px', background: '#fff' }}>
          <div className="of-wrap" style={{ maxWidth: '760px' }}>
            <SectionLabel>Benefit</SectionLabel>
            <SectionTitle>특별 혜택</SectionTitle>
            <div style={{ background: '#fff8f2', border: '1px solid #f0dcc8', borderRadius: '12px', padding: '28px 30px', marginTop: '24px' }}>
              <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#a8642a', margin: '0 0 12px' }}>{data.guarantee_title}</h3>
              <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>
                {data.guarantee_detail || '보장 금액 및 세부 조건은 문의 시 안내드립니다.'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── 단지 개요 ── */}
      {overviewRows.length > 0 && (
        <section style={{ padding: '64px 0 72px', background: '#f8f8f8' }}>
          <div className="of-wrap" style={{ maxWidth: '760px' }}>
            <SectionLabel>Complex</SectionLabel>
            <SectionTitle>단지 개요</SectionTitle>
            <div className="of-overview-table" style={{ marginTop: '24px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '8px 24px' }}>
              {overviewRows.map((row, i) => (
                <div key={i} className={`of-overview-row${row.label ? '' : ' full'}`}>
                  {row.label && <div className="of-overview-label">{row.label}</div>}
                  <div className="of-overview-value">{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 기본 제공 품목 ── */}
      {itemLines.length > 0 && (
        <section style={{ padding: '64px 0 72px', background: '#fff' }}>
          <div className="of-wrap" style={{ maxWidth: '760px' }}>
            <SectionLabel>Items</SectionLabel>
            <SectionTitle>기본 제공 품목</SectionTitle>
            <ul className="of-list of-items-grid" style={{ marginTop: '24px' }}>
              {itemLines.map((line, i) => (
                <li key={i} className="of-list-item">
                  <Check size={18} color="#c47c30" strokeWidth={2.4} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── 입지·교통 ── */}
      {locationLines.length > 0 && (
        <section style={{ padding: '64px 0 72px', background: '#f8f8f8' }}>
          <div className="of-wrap" style={{ maxWidth: '760px' }}>
            <SectionLabel>Location</SectionLabel>
            <SectionTitle>입지·교통</SectionTitle>
            <div style={{ marginTop: '24px' }}>
              <CheckList lines={locationLines} />
            </div>
          </div>
        </section>
      )}

      {/* ── 건물·주거 특징 ── */}
      {buildingLines.length > 0 && (
        <section style={{ padding: '64px 0 72px', background: '#fff' }}>
          <div className="of-wrap" style={{ maxWidth: '760px' }}>
            <SectionLabel>Building</SectionLabel>
            <SectionTitle>건물·주거 특징</SectionTitle>
            <div style={{ marginTop: '24px' }}>
              <CheckList lines={buildingLines} />
            </div>
          </div>
        </section>
      )}

      {/* ── 이런 분께 추천 ── */}
      {targetLines.length > 0 && (
        <section style={{ padding: '64px 0 72px', background: '#f8f8f8' }}>
          <div className="of-wrap" style={{ maxWidth: '760px' }}>
            <SectionLabel>Who</SectionLabel>
            <SectionTitle>이런 분께 추천합니다</SectionTitle>
            <div style={{ marginTop: '24px' }}>
              <CheckList lines={targetLines} />
            </div>
          </div>
        </section>
      )}

      {/* ── 갤러리 ── */}
      {galleryItems.length > 0 && (
        <section style={{ padding: '64px 0 72px', background: '#fff' }}>
          <div className="of-wrap">
            <SectionLabel>Gallery</SectionLabel>
            <SectionTitle>사진</SectionTitle>
            <p style={{ textAlign: 'center', fontSize: '14px', color: '#888', margin: '0 0 28px' }}>클릭하면 크게 볼 수 있습니다.</p>
            <Gallery items={galleryItems} />
          </div>
        </section>
      )}

      {/* ── 자주 묻는 질문 ──
          <details>/<summary> 네이티브 방식 사용 — 접힌 상태에서도 질문/답 전체가 서버 HTML에 포함됨
          (클라이언트에서만 그리는 아코디언 아님). */}
      {faqItems.length > 0 && (
        <section style={{ padding: '64px 0 72px', background: '#f8f8f8' }}>
          <div className="of-wrap" style={{ maxWidth: '760px' }}>
            <SectionLabel>FAQ</SectionLabel>
            <SectionTitle>자주 묻는 질문</SectionTitle>
            <div style={{ marginTop: '24px' }}>
              {faqItems.map((item, i) => (
                <details key={i} className="of-faq-item">
                  <summary className="of-faq-q">
                    <span className="of-faq-q-badge">Q</span>
                    <span className="of-faq-q-text">{item.question}</span>
                    <span className="of-faq-q-toggle">+</span>
                  </summary>
                  <div className="of-faq-a">{item.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 추가 소개 ── */}
      {data.intro_text && (
        <section style={{ padding: '64px 0 72px', background: '#fff' }}>
          <div className="of-wrap" style={{ maxWidth: '760px' }}>
            <p style={{ fontSize: '15px', color: '#444', lineHeight: 1.9, margin: 0, whiteSpace: 'pre-line' }}>
              {data.intro_text}
            </p>
          </div>
        </section>
      )}

      {/* ── 문의 섹션 ── */}
      <section id="officetel-inquiry" style={{ padding: '72px 0 88px', background: '#f8f8f8' }}>
        <div className="of-wrap">
          <div className="of-inquiry-grid">
            <div>
              <SectionLabel>Contact</SectionLabel>
              <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 900, color: '#1a1a1a', lineHeight: 1.3, margin: '0 0 20px' }}>
                분양 문의 &amp;<br />
                <span style={{ color: '#c47c30' }}>조건 상담</span>
              </h2>
              <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.8, margin: '0 0 28px' }}>
                분양가·수익보장 조건 등 자세한 사항은 직접 문의 주시면 개별 안내드립니다.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <a href="tel:01086808151" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                  <div style={{ width: '44px', height: '44px', background: '#c47c30', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Phone size={18} color="#fff" strokeWidth={2} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>전화 상담</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#1a1a1a' }}>010-8680-8151</div>
                  </div>
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MapPin size={18} color="#888" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>중개사무소</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#444' }}>헤르만공인중개사사무소</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', border: '1px solid #e8e8e8' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 20px' }}>분양 문의 접수</h3>
              <OfficetelInquiryForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
