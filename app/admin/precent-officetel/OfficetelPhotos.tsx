'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { triggerPrecentRevalidate } from '@/lib/triggerPrecentRevalidate';
import { PHOTO_TAGS, isMissingColumnError } from '@/lib/precentOfficetelTags';
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
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Photo = { id: string; url: string; sort_order: number; tag: string | null; caption: string | null };

// 오피스텔 소개 사진 업로드 전 브라우저에서 WebP로 변환 — 호실 사진 관리(PhotoManagerModal)와 동일 기준
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

function SortablePhotoCard({
  photo,
  index,
  onDelete,
  onUpdateField,
}: {
  photo: Photo;
  index: number;
  onDelete: (photo: Photo) => void;
  onUpdateField: (photo: Photo, field: 'tag' | 'caption', value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const [captionDraft, setCaptionDraft] = useState(photo.caption ?? '');

  useEffect(() => { setCaptionDraft(photo.caption ?? ''); }, [photo.caption]);

  const style: React.CSSProperties = {
    position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#fff',
    border: '1px solid #eee', display: 'flex', flexDirection: 'column',
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? '0 6px 16px rgba(0,0,0,0.25)' : undefined,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#f3f4f6', flexShrink: 0 }}>
        <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <span
          {...attributes}
          {...listeners}
          aria-label="순서 변경 손잡이"
          style={{
            position: 'absolute', top: '4px', left: '4px', width: '26px', height: '26px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '15px', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', touchAction: 'none',
          }}
        >⠿</span>
        {index === 0 && (
          <span style={{ position: 'absolute', top: '4px', right: '4px', background: '#c47c30', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
            대표
          </span>
        )}
        <button
          onClick={() => onDelete(photo)}
          aria-label="삭제"
          style={{
            position: 'absolute', bottom: '4px', right: '4px', width: '26px', height: '26px', borderRadius: '50%',
            border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '13px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <select
          value={photo.tag ?? ''}
          onChange={e => onUpdateField(photo, 'tag', e.target.value)}
          style={{ width: '100%', height: '30px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '5px', padding: '0 4px', background: '#fff', color: '#333', boxSizing: 'border-box' }}
        >
          <option value="">미분류</option>
          {PHOTO_TAGS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input
          type="text"
          value={captionDraft}
          onChange={e => setCaptionDraft(e.target.value.slice(0, 40))}
          onBlur={() => {
            if (captionDraft !== (photo.caption ?? '')) onUpdateField(photo, 'caption', captionDraft);
          }}
          placeholder="설명(선택, 최대 40자)"
          maxLength={40}
          style={{ width: '100%', height: '30px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '5px', padding: '0 8px', boxSizing: 'border-box' }}
        />
      </div>
    </div>
  );
}

export default function OfficetelPhotos({ onError }: { onError: (msg: string | null) => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const busyRef = useRef(false);

  const load = async () => {
    // select('*') — tag/caption 컬럼이 아직 없는(SQL 미실행) 상태에서도 에러 없이 동작해야 함
    const { data, error } = await supabase
      .from('precent_officetel_photos')
      .select('*')
      .order('sort_order');
    if (error) { onError(`사진 목록을 불러오지 못했습니다: ${error.message}`); setLoading(false); return; }
    setPhotos((data ?? []).map((p: any) => ({
      id: p.id, url: p.url, sort_order: p.sort_order, tag: p.tag ?? null, caption: p.caption ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    onError(null);
    setUploading(true);
    busyRef.current = true;
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
        onError(`업로드 실패: 이미지 변환 중 오류가 발생했습니다 (${file.name}) — ${err?.message ?? err}`);
        continue;
      }

      let uploadedUrl: string;
      try {
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('folder', 'precent/officetel');
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          body: formData,
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        uploadedUrl = data.url;
      } catch (err: any) {
        onError(`업로드 실패: 사진을 서버로 올리는 중 오류가 발생했습니다 (${file.name}) — ${err?.message ?? err}`);
        continue;
      }

      try {
        const { error: insertError } = await supabase
          .from('precent_officetel_photos')
          .insert({ url: uploadedUrl, sort_order: nextOrder });
        if (insertError) throw insertError;
        nextOrder++;
      } catch (err: any) {
        onError(`업로드 실패: 사진 정보 저장 중 오류가 발생했습니다 (${file.name}) — ${err?.message ?? err}`);
        continue;
      }
    }

    setUploading(false);
    busyRef.current = false;
    setUploadProgress(null);
    await load();
    triggerPrecentRevalidate('/properties/boramae-precent-officetel');
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
      console.error('[프리센트 오피스텔 사진] R2 삭제 실패:', err);
    }
    const { error } = await supabase.from('precent_officetel_photos').delete().eq('id', photo.id);
    if (error) { onError(`삭제 실패: ${error.message}`); return; }
    await load();
    triggerPrecentRevalidate('/properties/boramae-precent-officetel');
  };

  const handleUpdateField = async (photo: Photo, field: 'tag' | 'caption', value: string) => {
    const patch = { [field]: value || null };
    setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, ...patch } : p));
    const { error } = await supabase.from('precent_officetel_photos').update(patch).eq('id', photo.id);
    if (error) {
      onError(isMissingColumnError(error) ? 'SQL 적용이 필요합니다 (precent_officetel_media.sql 실행 후 다시 시도하세요)' : `저장 실패: ${error.message}`);
      return;
    }
    onError(null);
    triggerPrecentRevalidate('/properties/boramae-precent-officetel');
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
    setPhotos(reordered); // 낙관적 업데이트
    onError(null);

    try {
      const results = await Promise.all(
        reordered.map((p, i) =>
          p.sort_order === i
            ? Promise.resolve({ error: null })
            : supabase.from('precent_officetel_photos').update({ sort_order: i }).eq('id', p.id)
        )
      );
      const failed = results.find((r: any) => r.error);
      if (failed?.error) throw failed.error;
      setPhotos(reordered.map((p, i) => ({ ...p, sort_order: i })));
      triggerPrecentRevalidate('/properties/boramae-precent-officetel');
    } catch (err: any) {
      setPhotos(previous); // 실패 시 원래 순서로 되돌림
      onError(`순서 변경 저장 실패: ${err?.message ?? err}`);
    }
  };

  return (
    <div>
      <p style={{ fontSize: '12px', color: '#999', margin: '0 0 12px 0', lineHeight: 1.6 }}>
        용도를 지정하면 방문자 페이지의 해당 위치(평면도, 단지 개요·입지·건물 특징 옆 사진)에 자동으로 들어갑니다.
        평면도는 호수 표시나 위치도(KEY MAP)가 있으면 지우고 올려주세요. 분양사 자료는 광고 사용 허락을 확인하세요.
      </p>

      <label style={{ display: 'block', marginBottom: '12px' }}>
        <div style={{ border: '2px dashed #ddd', borderRadius: '8px', padding: '18px', textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer', color: '#888', fontSize: '13px' }}>
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
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            handleUpload(files);
          }}
          style={{ display: 'none' }}
        />
      </label>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>불러오는 중...</p>
      ) : photos.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>등록된 사진이 없습니다.</p>
      ) : (
        <>
          <p style={{ fontSize: '12px', color: '#999', margin: '0 0 10px 0' }}>
            ⠿ 손잡이를 잡고 끌어서 순서를 바꿉니다. 1번째 사진이 대표 사진입니다.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                {photos.map((p, i) => (
                  <SortablePhotoCard key={p.id} photo={p} index={i} onDelete={handleDelete} onUpdateField={handleUpdateField} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}
