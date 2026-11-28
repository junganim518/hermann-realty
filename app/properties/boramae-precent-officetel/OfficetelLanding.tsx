'use client';

import { useState } from 'react';
import { Phone, MapPin, Check, Home, Ruler, Tag, CalendarCheck, Settings2, Car, Bath, Receipt, FileCheck } from 'lucide-react';
import OfficetelInquiryForm from './OfficetelInquiryForm';
import RevealObserver from './RevealObserver';
import MobileInquiryBar from './MobileInquiryBar';
import CountUpValue from './CountUpValue';
import PhotoLightbox, { type LightboxState } from './PhotoLightbox';
import { notoSansKR, notoSerifKR } from './fonts';
import { photoTagLabel } from '@/lib/precentOfficetelTags';
import { OFFICETEL_MAP_EMBED_SRC, OFFICETEL_MAP_SEARCH_URL } from './mapConstants';
import {
  BenefitIllustration, ComplexIllustration, BuildingIllustration, TargetIllustration, FaqIllustration,
  ITEM_ICON_MAP, matchItemIcon, LOCATION_ICON_MAP, matchLocationIcon,
} from './Illustrations';
import styles from './officetel.module.css';

// select('*')로 읽으므로(아래 "SQL 실행 전에도 정상 동작" 참고) 모든 필드를 optional로 둔다 —
// DB에 아직 없는 컬럼은 그냥 undefined로 들어오고, 그 경우 해당 섹션만 조용히 숨겨진다(에러 없음).
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
  stats_text?: string | null;
};

export type OfficetelPhoto = { id: string; url: string; sort_order: number; tag?: string | null; caption?: string | null };

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

export type StatItem = { value: string; label: string };

// "값 | 설명" 한 줄씩 → {value, label} 배열(첫 '|' 기준). '|' 없는 줄은 값만, 설명은 빈 문자열.
export function parseStats(text?: string | null): StatItem[] {
  return splitLines(text).map(line => {
    const idx = line.indexOf('|');
    if (idx === -1) return { value: line, label: '' };
    return { value: line.slice(0, idx).trim(), label: line.slice(idx + 1).trim() };
  });
}

function SectionHead({ eyebrow, title, sub, icon }: { eyebrow: string; title: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className={styles.sectionHead} data-reveal>
      {icon && <span className={styles.sectionHeadIcon}>{icon}</span>}
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <span className={styles.titleBar} />
      {sub && <p className={styles.sectionSub}>{sub}</p>}
    </div>
  );
}

function CheckList({ lines, emphasizeFirst }: { lines: string[]; emphasizeFirst?: boolean }) {
  return (
    <ul className={styles.checkList} data-reveal>
      {lines.map((line, i) => (
        <li key={i} className={styles.checkItem}>
          <span className={styles.checkIconWrap}>
            <Check size={16} color="#B8873B" strokeWidth={2.6} />
          </span>
          <span className={emphasizeFirst && i === 0 ? styles.checkItemStrong : undefined}>{line}</span>
        </li>
      ))}
    </ul>
  );
}

// 단지 개요/건물 특징/추천 대상 옆에 태그 사진이 있으면 사진을, 없으면 전달받은 일러스트를
// 2열(데스크톱)로 보여준다. 사진도 일러스트도 없을 때만 children만 그대로 보여준다.
function ZigzagWrap({
  photo, side, tagValue, onOpen, illustration, children,
}: {
  photo?: OfficetelPhoto;
  side: 'left' | 'right';
  tagValue?: string;
  onOpen: (photo: OfficetelPhoto) => void;
  illustration?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!photo && !illustration) return <>{children}</>;
  return (
    <div className={`${styles.zigzag} ${side === 'left' ? styles.zigzagImageLeft : styles.zigzagImageRight}`} data-reveal>
      <div className={styles.zigzagImage}>
        {photo ? (
          <button type="button" className={styles.zigzagImageWrap} onClick={() => onOpen(photo)} aria-label="사진 확대">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.caption || `프리센트 오피스텔 ${photoTagLabel(tagValue)}`}
              loading="lazy"
              className={styles.zigzagImg}
            />
          </button>
        ) : (
          <div className={styles.zigzagIlluWrap}>{illustration}</div>
        )}
      </div>
      <div className={styles.zigzagContent}>{children}</div>
    </div>
  );
}

const INFO_ICON: Record<string, typeof Home> = {
  unit_type: Home,
  area_text: Ruler,
  price_text: Tag,
  move_in_text: CalendarCheck,
  options_text: Settings2,
  parking_text: Car,
  rooms_text: Bath,
  maintenance_fee_text: Receipt,
  approval_date_text: FileCheck,
};

export default function OfficetelLanding({ data, photos }: { data: OfficetelPageData; photos: OfficetelPhoto[] }) {
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const openLightbox = (list: OfficetelPhoto[], index: number) => setLightbox({ photos: list, index });

  const heroPhoto = photos[0] ?? null;
  const heroBadges = [data.price_text, data.guarantee_title].filter(Boolean) as string[];

  const infoItems = ([
    data.unit_type && { key: 'unit_type', label: '타입', value: data.unit_type },
    data.area_text && { key: 'area_text', label: '전용면적', value: data.area_text },
    data.price_text && { key: 'price_text', label: '분양가', value: data.price_text },
    data.move_in_text && { key: 'move_in_text', label: '입주 가능일', value: data.move_in_text },
    data.options_text && { key: 'options_text', label: '옵션', value: data.options_text },
    data.parking_text && { key: 'parking_text', label: '주차', value: data.parking_text },
    data.rooms_text && { key: 'rooms_text', label: '방·욕실', value: data.rooms_text },
    data.maintenance_fee_text && { key: 'maintenance_fee_text', label: '관리비', value: data.maintenance_fee_text },
    data.approval_date_text && { key: 'approval_date_text', label: '사용승인일', value: data.approval_date_text },
  ].filter(Boolean)) as { key: string; label: string; value: string }[];

  const overviewRows = parseOverviewRows(data.complex_text);
  const itemLines = splitLines(data.items_text);
  const locationLines = splitLines(data.location_text);
  const buildingLines = splitLines(data.building_text);
  const targetLines = splitLines(data.target_text);
  const faqItems = parseFaq(data.faq_text);
  const statsItems = parseStats(data.stats_text);

  // 태그별 사진 분배 — 평면도 제외한 전부는 모자이크, floorplan만 모아 평면도 섹션,
  // exterior/around/view 첫 사진은 각 섹션 옆 지그재그 사진으로 사용.
  const mosaicPhotos = photos.filter(p => p.tag !== 'floorplan');
  const floorplanPhotos = photos.filter(p => p.tag === 'floorplan');
  const firstByTag = (tag: string) => photos.find(p => p.tag === tag);
  const exteriorPhoto = firstByTag('exterior');
  const aroundPhoto = firstByTag('around');
  const viewPhoto = firstByTag('view');

  const title = data.title ?? '프리센트 오피스텔 특별분양';
  const rootId = 'of-landing-root';

  // 자동 번호 — 값이 있는 섹션만 실제로 렌더링되는 순서대로 01, 02, ... 가 매겨짐(하드코딩 없음)
  let sectionCounter = 0;
  const sectionNum = () => String(++sectionCounter).padStart(2, '0');

  const mosaicVisible = mosaicPhotos.length >= 5 ? mosaicPhotos.slice(0, 5) : mosaicPhotos;
  const mosaicMoreCount = mosaicPhotos.length > 5 ? mosaicPhotos.length - 5 : 0;

  return (
    <main id={rootId} className={`${styles.root} ${notoSansKR.variable} ${notoSerifKR.variable}`}>
      <RevealObserver rootId={rootId} />

      {/* ── 히어로 (레이아웃/구성 그대로, 색만 새 톤으로 조화) ── */}
      <section className={styles.heroSection}>
        <div className={styles.heroSplit}>
          <div className={styles.heroLeft}>
            <div className={styles.heroBadge}>BORAMAE · OFFICETEL · 특별분양</div>
            <h1 className={styles.heroTitle}>{title}</h1>
            {data.summary_text && (
              <p className={styles.heroSummary}>{data.summary_text}</p>
            )}
            {heroBadges.length > 0 && (
              <div className={styles.heroSpecRow}>
                {heroBadges.map(b => <span key={b} className={styles.heroChip}>{b}</span>)}
              </div>
            )}
            <div className={styles.ctaGroup} style={{ marginTop: '28px' }}>
              <a href="tel:01086808151" className={styles.ctaBtn}>
                <Phone size={16} strokeWidth={2} />
                전화 상담
              </a>
              <a href="#officetel-inquiry" className={styles.ctaOutline}>
                문의하기
              </a>
            </div>
          </div>
          {heroPhoto && (
            <div className={styles.heroRight}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroPhoto.url} alt={title} loading="eager" />
              <div className={styles.heroOverlay} />
            </div>
          )}
        </div>
      </section>

      {/* ── 숫자 띠 ── */}
      {statsItems.length > 0 && (
        <section className={styles.statsBand} data-reveal>
          <div className={styles.wrap}>
            <div className={styles.statsGrid}>
              {statsItems.map((s, i) => (
                <div key={i} className={styles.statItem}>
                  <div className={styles.statValue}><CountUpValue value={s.value} /></div>
                  {s.label && <div className={styles.statLabel}>{s.label}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 핵심 정보 ── */}
      {infoItems.length > 0 && (
        <section className={styles.sectionLight}>
          <div className={styles.wrap}>
            <SectionHead eyebrow={`${sectionNum()} · Overview`} title="핵심 정보" />
            <div className={styles.infoGrid}>
              {infoItems.map(item => {
                const Icon = INFO_ICON[item.key] ?? Home;
                return (
                  <div key={item.key} className={styles.infoCard} data-reveal-card>
                    <div className={styles.infoIconWrap}>
                      <Icon size={22} color="#B8873B" strokeWidth={1.8} />
                    </div>
                    <div className={styles.infoLabel}>{item.label}</div>
                    <div className={styles.infoValue}>{item.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 사진 모자이크 갤러리 ── */}
      {mosaicPhotos.length > 0 && (
        <section className={styles.sectionAlt}>
          <div className={styles.wrap}>
            <SectionHead eyebrow={`${sectionNum()} · Gallery`} title="사진으로 미리 보기" />
            <div className={mosaicPhotos.length >= 5 ? styles.mosaicFull : styles.mosaicSimple}>
              {mosaicVisible.map((p, i) => {
                const isBig = mosaicPhotos.length >= 5 && i === 0;
                const isOverlay = mosaicMoreCount > 0 && i === mosaicVisible.length - 1;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.mosaicTile} ${isBig ? styles.mosaicBig : ''}`}
                    data-reveal-card
                    onClick={() => openLightbox(mosaicPhotos, i)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={p.caption || `프리센트 오피스텔 ${photoTagLabel(p.tag)}`}
                      loading="lazy"
                      className={styles.mosaicImg}
                    />
                    {isOverlay && (
                      <span className={styles.mosaicMore}>+{mosaicMoreCount}장 더보기</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 특별 혜택(수익보장) ── */}
      {data.guarantee_title && (
        <section className={styles.sectionLight}>
          <div className={`${styles.wrap} ${styles.wrapNarrow}`}>
            <SectionHead eyebrow={`${sectionNum()} · Benefit`} title="특별 혜택" />
            <div className={styles.benefitGrid} data-reveal>
              <div className={styles.benefitIlluWrap}>
                <BenefitIllustration />
              </div>
              <div className={styles.benefitCard}>
                <h3 className={styles.benefitTitle}>{data.guarantee_title}</h3>
                <p className={styles.benefitBody}>
                  {data.guarantee_detail || '보장 금액 및 세부 조건은 문의 시 안내드립니다.'}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 평면도 ── */}
      {floorplanPhotos.length > 0 && (
        <section className={styles.sectionLight}>
          <div className={`${styles.wrap} ${styles.wrapNarrow}`}>
            <SectionHead eyebrow={`${sectionNum()} · Floor Plan`} title="평면도" />
            <div className={styles.floorplanRow} data-reveal>
              {floorplanPhotos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.floorplanCard}
                  onClick={() => openLightbox(floorplanPhotos, i)}
                >
                  <div className={styles.floorplanImgWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={p.caption || `프리센트 오피스텔 ${photoTagLabel('floorplan')}`}
                      loading="lazy"
                      className={styles.floorplanImg}
                    />
                  </div>
                  {(data.area_text || p.caption) && (
                    <div className={styles.floorplanMeta}>
                      {[data.area_text, p.caption].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className={styles.floorplanNote}>평면도는 이해를 돕기 위한 것으로 실제와 일부 다를 수 있습니다.</p>
          </div>
        </section>
      )}

      {/* ── 단지 개요 ── */}
      {overviewRows.length > 0 && (
        <section className={styles.sectionAlt}>
          <div className={styles.wrap}>
            <SectionHead eyebrow={`${sectionNum()} · Complex`} title="단지 개요" />
            <ZigzagWrap
              photo={exteriorPhoto}
              side="left"
              tagValue="exterior"
              onOpen={p => openLightbox([p], 0)}
              illustration={<ComplexIllustration />}
            >
              <div className={styles.overviewTable} data-reveal>
                {overviewRows.map((row, i) => (
                  <div key={i} className={`${styles.overviewRow}${row.label ? '' : ` ${styles.full}`}`}>
                    {row.label && <div className={styles.overviewLabel}>{row.label}</div>}
                    <div className={styles.overviewValue}>{row.value}</div>
                  </div>
                ))}
              </div>
            </ZigzagWrap>
          </div>
        </section>
      )}

      {/* ── 기본 제공 품목 ── */}
      {itemLines.length > 0 && (
        <section className={styles.sectionLight}>
          <div className={`${styles.wrap} ${styles.wrapNarrow}`}>
            <SectionHead eyebrow={`${sectionNum()} · Items`} title="기본 제공 품목" />
            <div className={styles.itemsGrid}>
              {itemLines.map((line, i) => {
                const Icon = ITEM_ICON_MAP[matchItemIcon(line)];
                return (
                  <div key={i} className={styles.itemCard} data-reveal-card>
                    <span className={styles.itemCardIconWrap}><Icon /></span>
                    <span className={styles.itemCardText}>{line}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 입지·교통: 지도(+사진이 있으면 함께), 아래에 아이콘 목록 ── */}
      {locationLines.length > 0 && (
        <section className={styles.sectionAlt}>
          <div className={styles.wrap}>
            <SectionHead eyebrow={`${sectionNum()} · Location`} title="입지·교통" />
            <div
              className={`${styles.mapRow} ${aroundPhoto ? styles.mapRowWithPhoto : styles.mapRowSingle}`}
              data-reveal
            >
              <div className={styles.mapFrameWrap}>
                <iframe
                  src={OFFICETEL_MAP_EMBED_SRC}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="동작 보라매역 프리센트 위치 지도"
                  className={styles.mapFrame}
                />
              </div>
              {aroundPhoto && (
                <button
                  type="button"
                  className={styles.mapPhotoWrap}
                  onClick={() => openLightbox([aroundPhoto], 0)}
                  aria-label="주변 사진 확대"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={aroundPhoto.url}
                    alt={aroundPhoto.caption || `프리센트 오피스텔 ${photoTagLabel('around')}`}
                    loading="lazy"
                    className={styles.mapPhotoImg}
                  />
                </button>
              )}
            </div>
            <div className={styles.mapFooter}>
              <a href={OFFICETEL_MAP_SEARCH_URL} target="_blank" rel="noopener noreferrer" className={styles.mapLink}>
                지도 크게 보기 →
              </a>
              <p className={styles.mapCaption}>지도는 대략적인 위치이며 실제와 다를 수 있습니다.</p>
            </div>
            <div className={styles.locationListWrap} data-reveal>
              {locationLines.map((line, i) => {
                const Icon = LOCATION_ICON_MAP[matchLocationIcon(line)];
                return (
                  <div key={i} className={styles.iconListItem}>
                    <span className={styles.iconListIconWrap}><Icon /></span>
                    <span className={i === 0 ? styles.checkItemStrong : undefined}>{line}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 건물·주거 특징 ── */}
      {buildingLines.length > 0 && (
        <section className={styles.sectionLight}>
          <div className={styles.wrap}>
            <SectionHead eyebrow={`${sectionNum()} · Building`} title="건물·주거 특징" />
            <ZigzagWrap
              photo={viewPhoto}
              side="right"
              tagValue="view"
              onOpen={p => openLightbox([p], 0)}
              illustration={<BuildingIllustration />}
            >
              <CheckList lines={buildingLines} />
            </ZigzagWrap>
          </div>
        </section>
      )}

      {/* ── 이런 분께 추천 ── */}
      {targetLines.length > 0 && (
        <section className={styles.sectionAlt}>
          <div className={styles.wrap}>
            <SectionHead eyebrow={`${sectionNum()} · Who`} title="이런 분께 추천합니다" />
            <ZigzagWrap side="left" onOpen={p => openLightbox([p], 0)} illustration={<TargetIllustration />}>
              <CheckList lines={targetLines} />
            </ZigzagWrap>
          </div>
        </section>
      )}

      {/* ── 자주 묻는 질문 ──
          <details>/<summary> 네이티브 방식 사용 — 접힌 상태에서도 질문/답 전체가 서버 HTML에 포함됨
          (클라이언트에서만 그리는 아코디언 아님). 등장 효과는 목록 전체에 한 번만(개별 질문엔 안 걺). */}
      {faqItems.length > 0 && (
        <section className={styles.sectionLight}>
          <div className={`${styles.wrap} ${styles.wrapNarrow}`}>
            <SectionHead eyebrow={`${sectionNum()} · FAQ`} title="자주 묻는 질문" icon={<FaqIllustration />} />
            <div data-reveal>
              {faqItems.map((item, i) => (
                <details key={i} className={styles.faqItem}>
                  <summary className={styles.faqQ}>
                    <span className={styles.faqBadge}>Q</span>
                    <span className={styles.faqQText}>{item.question}</span>
                    <span className={styles.faqToggle}>+</span>
                  </summary>
                  <div className={styles.faqA}>{item.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 추가 소개 ── */}
      {data.intro_text && (
        <section className={styles.sectionAlt}>
          <div className={`${styles.wrap} ${styles.wrapNarrow}`}>
            <p className={styles.introText} data-reveal>{data.intro_text}</p>
          </div>
        </section>
      )}

      {/* ── 문의 섹션 ── */}
      <section id="officetel-inquiry" className={styles.sectionLight}>
        <div className={styles.wrap}>
          <div className={styles.inquiryGrid}>
            <div data-reveal>
              <span className={styles.eyebrow}>{`${sectionNum()} · Contact`}</span>
              <h2 className={styles.inquiryHeading}>
                분양 문의 &amp;<br />
                <span className={styles.inquiryGold}>조건 상담</span>
              </h2>
              <p className={styles.inquiryLead}>
                분양가·수익보장 조건 등 자세한 사항은 직접 문의 주시면 개별 안내드립니다.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <a href="tel:01086808151" className={styles.contactRow} style={{ textDecoration: 'none' }}>
                  <div className={styles.contactIconWrap}>
                    <Phone size={20} color="#fff" strokeWidth={2} />
                  </div>
                  <div>
                    <div className={styles.contactLabel}>전화 상담</div>
                    <div className={styles.contactValue}>010-8680-8151</div>
                  </div>
                </a>
                <div className={styles.contactRow}>
                  <div className={styles.contactIconWrapSoft}>
                    <MapPin size={20} color="#8a6425" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className={styles.contactLabel}>중개사무소</div>
                    <div className={styles.contactValueSoft}>헤르만공인중개사사무소</div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.inquiryCard} data-reveal>
              <h3 className={styles.inquiryCardTitle}>분양 문의 접수</h3>
              <OfficetelInquiryForm />
            </div>
          </div>
        </div>
      </section>

      <MobileInquiryBar />
      <PhotoLightbox
        state={lightbox}
        onClose={() => setLightbox(null)}
        onNavigate={i => setLightbox(prev => prev ? { ...prev, index: i } : prev)}
      />
    </main>
  );
}
