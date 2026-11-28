'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import OfficetelLanding, { type OfficetelPageData, type OfficetelPhoto } from '@/app/properties/boramae-precent-officetel/OfficetelLanding';

export default function PrecentOfficetelPreviewPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState<OfficetelPageData | null>(null);
  const [published, setPublished] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<OfficetelPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return; }
      setAuthChecked(true);
    });
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      const [{ data: pageRow, error: pageErr }, { data: photoRows, error: photoErr }] = await Promise.all([
        supabase.from('precent_officetel_page').select('*').eq('id', 1).maybeSingle(),
        supabase.from('precent_officetel_photos').select('*').order('sort_order'),
      ]);
      if (pageErr) { setErrorMsg(`불러오기 실패: ${pageErr.message}`); setLoading(false); return; }
      if (photoErr) { setErrorMsg(`사진 불러오기 실패: ${photoErr.message}`); setLoading(false); return; }
      if (!pageRow) { setErrorMsg('초기 데이터가 없습니다. SQL을 먼저 실행하세요.'); setLoading(false); return; }
      setData(pageRow as OfficetelPageData);
      setPublished(!!pageRow.published);
      setPhotos((photoRows ?? []) as OfficetelPhoto[]);
      setLoading(false);
    })();
  }, [authChecked]);

  if (!authChecked) return null;

  return (
    <div>
      <div style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#1a1a1a', color: '#fff', padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 700 }}>
        미리보기 — 방문자에게 공개되지 않습니다 {published !== null && `(현재: ${published ? '게시 중' : '비공개'})`}
      </div>
      {loading ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '60px 20px' }}>불러오는 중...</p>
      ) : errorMsg || !data ? (
        <p style={{ textAlign: 'center', color: '#888', padding: '60px 20px' }}>{errorMsg ?? '불러올 수 없습니다.'}</p>
      ) : (
        <OfficetelLanding data={data} photos={photos} />
      )}
    </div>
  );
}
