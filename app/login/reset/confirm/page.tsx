'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type PageState = 'checking' | 'error' | 'form' | 'success';

function getUrlError(): { code: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  const errorCode = params.get('error_code');
  if (error || errorCode) return { code: errorCode || error || 'unknown' };
  return null;
}

function getErrorMessage(code: string): string {
  if (code === 'otp_expired') return '재설정 링크가 만료됐습니다 (1시간 유효).\n새 메일을 요청해주세요.';
  if (code === 'access_denied') return '재설정 링크가 유효하지 않습니다.\n새 메일을 요청해주세요.';
  return '오류가 발생했습니다.\n새 메일을 요청해주세요.';
}

export default function ResetConfirmPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('checking');
  const [errorCode, setErrorCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    // URL에 에러 파라미터 있으면 즉시 에러 표시
    const urlError = getUrlError();
    if (urlError) {
      setErrorCode(urlError.code);
      setPageState('error');
      return;
    }

    // PASSWORD_RECOVERY 이벤트 대기
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPageState('form');
    });

    // 10초 후에도 이벤트 없으면 에러로 전환
    const timeout = setTimeout(() => {
      setPageState(prev => {
        if (prev === 'checking') { setErrorCode('access_denied'); return 'error'; }
        return prev;
      });
    }, 10000);

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (password.length < 8) { setFormError('비밀번호는 최소 8자 이상이어야 합니다.'); return; }
    if (password !== confirmPw) { setFormError('비밀번호가 일치하지 않습니다.'); return; }

    setLoading(true);
    const { error: authErr } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (authErr) { setFormError('비밀번호 변경에 실패했습니다. 링크가 만료되었을 수 있습니다.'); return; }

    setPageState('success');
    setTimeout(() => router.push('/'), 2000);
  };

  const logo = (
    <img src="/logo.png" alt="로고" style={{ width: '60px', height: '60px', objectFit: 'contain', margin: '0 auto 16px', display: 'block' }} />
  );

  const wrap = (children: React.ReactNode) => (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 20px' }}>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '40px 32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          {children}
        </div>
      </div>
    </main>
  );

  if (pageState === 'checking') return wrap(
    <div style={{ textAlign: 'center' }}>
      {logo}
      <p style={{ fontSize: '14px', color: '#666' }}>인증 확인 중...</p>
    </div>
  );

  if (pageState === 'error') return wrap(
    <div style={{ textAlign: 'center' }}>
      {logo}
      <div style={{ fontSize: '36px', marginBottom: '16px' }}>⚠️</div>
      <p style={{ fontSize: '15px', color: '#c0392b', fontWeight: 600, marginBottom: '4px', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
        {getErrorMessage(errorCode)}
      </p>
      <a
        href="/login/reset"
        style={{
          display: 'inline-block', marginTop: '20px',
          padding: '12px 24px', background: '#e2a06e', color: '#fff',
          borderRadius: '6px', fontSize: '15px', fontWeight: 700, textDecoration: 'none',
        }}
      >
        재설정 메일 다시 요청
      </a>
    </div>
  );

  if (pageState === 'success') return wrap(
    <div style={{ textAlign: 'center' }}>
      {logo}
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
      <p style={{ fontSize: '15px', color: '#333', marginBottom: '8px' }}>비밀번호가 변경되었습니다.</p>
      <p style={{ fontSize: '13px', color: '#999' }}>잠시 후 이동합니다...</p>
    </div>
  );

  return wrap(
    <>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        {logo}
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#e2a06e', margin: '0 0 4px' }}>새 비밀번호 설정</h1>
      </div>
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
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            placeholder="비밀번호 다시 입력"
            required
            style={{ width: '100%', height: '44px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {formError && (
          <p style={{ fontSize: '13px', color: '#e05050', marginBottom: '16px', textAlign: 'center' }}>{formError}</p>
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
    </>
  );
}
