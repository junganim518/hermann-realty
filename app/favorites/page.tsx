'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, X, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  getFavorites,
  removeFavorite,
  clearFavorites,
  syncFavorites,
} from '@/lib/favorites';
import PropertyCard from '@/components/PropertyCard';

export default function FavoritesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = async () => {
    setLoading(true);
    const favs = getFavorites();
    if (favs.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const ids = favs.map(f => f.propertyId);
    const { data: props } = await supabase
      .from('properties')
      .select('*')
      .in('id', ids)
      .neq('status', '보류');

    const found = props ?? [];
    syncFavorites(found.map((p: any) => p.id));

    const withImages = await Promise.all(
      found.map(async (p: any) => {
        const { data: imgs } = await supabase
          .from('property_images')
          .select('image_url')
          .eq('property_id', p.id)
          .order('order_index', { ascending: true })
          .limit(1);
        return { ...p, image: imgs?.[0]?.image_url ?? null };
      })
    );

    // 즐겨찾기 추가 순서 유지 (최신이 0번째)
    const idOrder = new Map(getFavorites().map((f, i) => [f.propertyId, i]));
    withImages.sort(
      (a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999)
    );
    setItems(withImages);
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
    const handler = () => loadItems();
    window.addEventListener('favoritesChanged', handler);
    return () => window.removeEventListener('favoritesChanged', handler);
  }, []);

  const handleRemove = (id: string) => {
    removeFavorite(id);
    setItems(prev => prev.filter(p => p.id !== id));
  };

  const handleClearAll = () => {
    if (!confirm('즐겨찾기 목록을 모두 삭제하시겠습니까?')) return;
    clearFavorites();
    setItems([]);
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f9f9f9', padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>즐겨찾기</h1>
            <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>총 {items.length}개</p>
          </div>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '8px 14px', border: '1px solid #e05050', borderRadius: '6px',
                background: '#fff', color: '#e05050', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={14} /> 전체 삭제
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '60px 0', color: '#888', fontSize: '14px' }}>불러오는 중...</p>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 16px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
            <Heart size={48} strokeWidth={1.5} color="#ccc" style={{ display: 'inline-block', marginBottom: '12px' }} />
            <p style={{ fontSize: '15px', color: '#888', marginBottom: '20px' }}>즐겨찾기한 매물이 없습니다</p>
            <Link
              href="/properties"
              style={{
                display: 'inline-block', padding: '10px 22px',
                background: '#1a1a1a', color: '#e2a06e',
                fontSize: '14px', fontWeight: 700, borderRadius: '6px',
                textDecoration: 'none',
              }}
            >
              매물 둘러보기 →
            </Link>
          </div>
        ) : (
          <div className="fav-grid" style={{ display: 'grid', gap: '12px' }}>
            {items.map(p => (
              <div key={p.id} style={{ position: 'relative' }}>
                <PropertyCard property={p} />
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemove(p.id); }}
                  aria-label="즐겨찾기에서 제거"
                  title="즐겨찾기 해제"
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 5,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#e05050')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.55)')}
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .fav-grid { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 1199px) {
          .fav-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 767px) {
          .fav-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
        }
      ` }} />
    </main>
  );
}
