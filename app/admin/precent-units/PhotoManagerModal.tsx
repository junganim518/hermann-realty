'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Photo = { id: string; url: string; sort_order: number };

// 호실 사진 업로드 전 브라우저에서 WebP로 변환 (가로 1600px, 품질 82 — 건물 갤러리와 동일 기준)
const compressToWebP = (file: File, maxWidth = 1600, quality = 0.82): Promise<File> => {
  return new Promise((resolve) => {
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
      if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) { resolve(file); return; }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          resolve(new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() }));
        },
        'image/webp',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
};

const btnSt: React.CSSProperties = {
  height: '28px', padding: '0 10px', fontSize: '12px', fontWeight: 600,
  border: '1px solid #ddd', borderRadius: '5px', background: '#fff', color: '#555', cursor: 'pointer',
};

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

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    const { data: { session } } = await supabase.auth.getSession();
    let nextOrder = photos.length > 0 ? Math.max(...photos.map(p => p.sort_order)) + 1 : 0;

    for (const file of Array.from(fileList)) {
      try {
        const compressed = await compressToWebP(file);
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

        const { error: insertError } = await supabase
          .from('precent_unit_photos')
          .insert({ unit_id: unitId, url: data.url, sort_order: nextOrder });
        if (insertError) throw insertError;
        nextOrder++;
      } catch (err: any) {
        alert(`사진 업로드 실패: ${err?.message ?? err}`);
      }
    }
    setUploading(false);
    await load();
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
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= photos.length) return;
    const reordered = [...photos];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    const results = await Promise.all(
      reordered.map((p, i) => supabase.from('precent_unit_photos').update({ sort_order: i }).eq('id', p.id))
    );
    const failed = results.find(r => r.error);
    if (failed?.error) { alert(`순서 변경 실패: ${failed.error.message}`); }
    await load();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: '10px', padding: '20px', width: '100%', maxWidth: '560px', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>{unitNo}호 사진 관리</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>✕</button>
        </div>

        <label style={{ display: 'block', marginBottom: '14px' }}>
          <div style={{ border: '2px dashed #ddd', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer', color: '#888', fontSize: '13px' }}>
            {uploading ? '업로드 중...' : '+ 사진 올리기 (여러 장 선택 가능)'}
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={e => { handleUpload(e.target.files); e.target.value = ''; }}
            style={{ display: 'none' }}
          />
        </label>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>불러오는 중...</p>
        ) : photos.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>등록된 사진이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {photos.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #eee', borderRadius: '6px', padding: '8px' }}>
                <img src={p.url} alt="" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: '12px', color: '#999' }}>{i + 1}번째</div>
                <button onClick={() => move(i, -1)} disabled={i === 0} style={btnSt}>↑</button>
                <button onClick={() => move(i, 1)} disabled={i === photos.length - 1} style={btnSt}>↓</button>
                <button onClick={() => handleDelete(p)} style={{ ...btnSt, color: '#e05050', borderColor: '#f0c8c8' }}>삭제</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
