'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { triggerPrecentRevalidate } from '@/lib/triggerPrecentRevalidate';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Photo = { id: string; url: string; sort_order: number };

// 호실 사진 업로드 전 브라우저에서 WebP로 변환 (가로 1600px, 품질 82 — 건물 갤러리와 동일 기준)
const compressToWebP = (file: File, maxWidth = 1600, quality = 0.82): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('캔버스를 생성할 수 없습니다.')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) { reject(new Error('이미지를 WebP로 변환하지 못했습니다.')); return; }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          resolve(new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() }));
        },
        'image/webp',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 파일을 읽을 수 없습니다.')); };
    img.src = url;
  });
};

const btnSt: React.CSSProperties = {
  height: '28px', padding: '0 10px', fontSize: '12px', fontWeight: 600,
  border: '1px solid #ddd', borderRadius: '5px', background: '#fff', color: '#555', cursor: 'pointer',
};

function SortablePhotoRow({
  photo,
  index,
  dragDisabled,
  onDelete,
}: {
  photo: Photo;
  index: number;
  dragDisabled: boolean;
  onDelete: (photo: Photo) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
    disabled: dragDisabled,
  });

  const style: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '10px',
    border: '1px solid #eee', borderRadius: '6px', padding: '8px',
    background: '#fff',
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? '0 6px 16px rgba(0,0,0,0.18)' : undefined,
    position: 'relative',
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...(dragDisabled ? {} : attributes)}
        {...(dragDisabled ? {} : listeners)}
        aria-label="순서 변경 손잡이"
        style={{
          fontSize: '18px', lineHeight: 1, flexShrink: 0, padding: '6px 2px',
          color: dragDisabled ? '#ddd' : '#999',
          cursor: dragDisabled ? 'default' : 'grab',
          touchAction: 'none',
        }}
      >⠿</span>
      <img src={photo.url} alt="" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: '12px', color: '#999' }}>{index + 1}번째</div>
      <button onClick={() => onDelete(photo)} style={{ ...btnSt, color: '#e05050', borderColor: '#f0c8c8' }}>삭제</button>
    </div>
  );
}

export default function PhotoManagerModal({
  unitId,
  unitNo,
  onClose,
  onCountChange,
}: {
  unitId: string;
  unitNo: string;
  onClose: () => void;
  onCountChange: (unitId: string, count: number) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = uploading || savingOrder;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('precent_unit_photos')
      .select('id, url, sort_order')
      .eq('unit_id', unitId)
      .order('sort_order');
    const list = (data ?? []) as Photo[];
    setPhotos(list);
    setLoading(false);
    onCountChange(unitId, list.length);
  };

  useEffect(() => { load(); }, [unitId]);

  // 모달이 열려 있는 동안 뒷배경 스크롤 잠금 (스크롤바가 사라지며 생기는 가로 밀림은 padding-right로 보정)
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  const attemptClose = () => {
    if (busyRef.current) return; // 업로드/순서 저장 중에는 실수로 닫히지 않게
    onClose();
  };

  // ESC로 닫기
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') attemptClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // files는 호출 시점에 이미 일반 배열로 스냅샷된 상태여야 함 (input의 FileList를 그대로
  // 비동기 함수에 넘기면, 아래 getSession() await 도중 onChange 핸들러가 입력값을 리셋해버려서
  // 그 사이에 FileList가 비어버리는 문제가 있었음)
  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    const { data: { session } } = await supabase.auth.getSession();
    let nextOrder = photos.length > 0 ? Math.max(...photos.map(p => p.sort_order)) + 1 : 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length });

      let compressed: File;
      try {
        compressed = await compressToWebP(file);
      } catch (err: any) {
        setUploadError(`업로드 실패: 이미지 변환 중 오류가 발생했습니다 (${file.name}) — ${err?.message ?? err}`);
        continue;
      }

      let uploadedUrl: string;
      try {
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('folder', `precent/units/${unitNo}`);
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          body: formData,
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        uploadedUrl = data.url;
      } catch (err: any) {
        setUploadError(`업로드 실패: 사진을 서버로 올리는 중 오류가 발생했습니다 (${file.name}) — ${err?.message ?? err}`);
        continue;
      }

      try {
        const { error: insertError } = await supabase
          .from('precent_unit_photos')
          .insert({ unit_id: unitId, url: uploadedUrl, sort_order: nextOrder });
        if (insertError) throw insertError;
        nextOrder++;
      } catch (err: any) {
        setUploadError(`업로드 실패: 사진 정보 저장 중 오류가 발생했습니다 (${file.name}) — ${err?.message ?? err}`);
        continue;
      }
    }

    setUploading(false);
    setUploadProgress(null);
    await load();
    triggerPrecentRevalidate();
  };

  const handleDelete = async (photo: Photo) => {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return;
    try {
      const path = new URL(photo.url).pathname.replace(/^\//, '');
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/delete-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ path }),
      });
    } catch (err) {
      console.error('[프리센트 사진] R2 삭제 실패:', err);
    }
    const { error } = await supabase.from('precent_unit_photos').delete().eq('id', photo.id);
    if (error) { alert(`삭제 실패: ${error.message}`); return; }
    await load();
    triggerPrecentRevalidate();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 0, tolerance: 5 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = photos.findIndex(p => p.id === active.id);
    const newIndex = photos.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = photos;
    const reordered = arrayMove(photos, oldIndex, newIndex);
    setPhotos(reordered); // 낙관적 업데이트 — 화면에 즉시 반영
    setUploadError(null);
    setSavingOrder(true);

    try {
      const results = await Promise.all(
        reordered.map((p, i) =>
          p.sort_order === i
            ? Promise.resolve({ error: null })
            : supabase.from('precent_unit_photos').update({ sort_order: i }).eq('id', p.id)
        )
      );
      const failed = results.find((r: any) => r.error);
      if (failed?.error) throw failed.error;
      setPhotos(reordered.map((p, i) => ({ ...p, sort_order: i })));
      triggerPrecentRevalidate();
    } catch (err: any) {
      setPhotos(previous); // 실패 시 원래 순서로 되돌림
      setUploadError(`순서 변경 저장 실패: ${err?.message ?? err}`);
    } finally {
      setSavingOrder(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{`
        .pm-overlay { position: fixed; inset: 0; z-index: 999999; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .pm-panel { background: #fff; border-radius: 10px; width: 100%; max-width: 560px; max-height: calc(100vh - 32px); display: flex; flex-direction: column; overflow: hidden; }
        @supports (height: 100dvh) {
          .pm-panel { max-height: calc(100dvh - 32px); }
        }
        .pm-titlebar { display: flex; justify-content: space-between; align-items: center; padding: 20px 20px 0 20px; flex-shrink: 0; }
        .pm-scroll { overflow-y: auto; overscroll-behavior: contain; padding: 14px 20px 20px 20px; min-height: 0; flex: 1; }
      `}</style>
      <div className="pm-overlay" onClick={attemptClose}>
        <div className="pm-panel" onClick={e => e.stopPropagation()}>
          <div className="pm-titlebar">
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>{unitNo}호 사진 관리</h3>
            <button onClick={attemptClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>✕</button>
          </div>

          <div className="pm-scroll">
            <label style={{ display: 'block', marginBottom: uploadError ? '8px' : '14px' }}>
              <div style={{ border: '2px dashed #ddd', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer', color: '#888', fontSize: '13px' }}>
                {uploading && uploadProgress
                  ? `업로드 중... (${uploadProgress.current}/${uploadProgress.total})`
                  : '+ 사진 올리기 (여러 장 선택 가능)'}
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploading}
                onChange={e => {
                  // e.target.files(FileList)를 여기서 바로 일반 배열로 스냅샷해둬야 함 —
                  // 비동기 업로드 함수 안에서 나중에 읽으면 바로 아래 value 리셋 때문에 비어있을 수 있음
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  handleUpload(files);
                }}
                style={{ display: 'none' }}
              />
            </label>

            {uploadError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12px', borderRadius: '6px', padding: '8px 10px', marginBottom: '14px', lineHeight: 1.5 }}>
                {uploadError}
              </div>
            )}

            {loading ? (
              <p style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>불러오는 중...</p>
            ) : photos.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>등록된 사진이 없습니다.</p>
            ) : (
              <>
                <p style={{ fontSize: '12px', color: '#999', margin: '0 0 8px 0' }}>
                  ⠿ 손잡이를 잡고 끌어서 순서를 바꿉니다. 1번째 사진이 대표 사진입니다.
                </p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={photos.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {photos.map((p, i) => (
                        <SortablePhotoRow
                          key={p.id}
                          photo={p}
                          index={i}
                          dragDisabled={photos.length <= 1}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
