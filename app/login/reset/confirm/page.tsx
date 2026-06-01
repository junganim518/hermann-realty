'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ResetConfirmPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase가 URL 해시(#access_token=...)를 세션으로 변환할 때까지 대기
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    const { error: authErr } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (authErr) {
      setError('비밀번호 변경에 실패했습니다. 링크가 만료되었을 수 있습니다.');
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push('/'), 2000);
  };

  if (!sessionReady) {
    return (
      <main style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '400px', padding: '0 20px' }}>
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '40px 32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <img src="/logo.png" alt="로고" style={{ width: '60px', height: '60px', objectFit: 'contain', margin: '0 auto 16px', display: 'block' }} />
            <p style={{ fontSize: '14px', color: '#666' }}>인증 확인 중...</p>
            <p style={{ fontSize: '13px', color: '#999', marginTop: '8px' }}>
              링크가 유효하지 않으면 <a href="/login/reset" style={{ color: '#e2a06e' }}>재설정 메일을 다시 요청</a>해주세요.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 20px' }}>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '40px 32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>

          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <img src="/logo.png" alt="로고" style={{ width: '60px', height: '60px', objectFit: 'contain', margin: '0 auto 12px' }} />
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#e2a06e', margin: '0 0 4px' }}>새 비밀번호 설정</h1>
          </div>

          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
              <p style={{ fontSize: '15px', color: '#333', marginBottom: '8px' }}>비밀번호가 변경되었습니다.</p>
              <p style={{ fontSize: '13px', color: '#999' }}>잠시 후 이동합니다...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>새 비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8자 이상 입력"
                  required
                  style={{ width: '100%', height: '44px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>새 비밀번호 확인</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="비밀번호 다시 입력"
                  required
                  style={{ width: '100%', height: '44px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {error && (
                <p style={{ fontSize: '13px', color: '#e05050', marginBottom: '16px', textAlign: 'center' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', height: '48px', background: loading ? '#ccc' : '#e2a06e',
                  color: '#fff', border: 'none', borderRadius: '6px', fontSize: '16px',
                  fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
                }}
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
