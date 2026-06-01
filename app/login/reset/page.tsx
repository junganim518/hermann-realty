'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login/reset/confirm`,
    });

    setLoading(false);

    if (authErr) {
      setError('오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setSent(true);
  };

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 20px' }}>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '40px 32px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>

          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <img src="/logo.png" alt="로고" style={{ width: '60px', height: '60px', objectFit: 'contain', margin: '0 auto 12px' }} />
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#e2a06e', margin: '0 0 4px' }}>비밀번호 재설정</h1>
            <p style={{ fontSize: '13px', color: '#999' }}>가입한 이메일로 재설정 링크를 보내드립니다</p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📧</div>
              <p style={{ fontSize: '15px', color: '#333', lineHeight: 1.6, marginBottom: '24px' }}>
                메일을 발송했습니다.<br />이메일을 확인해주세요.
              </p>
              <p style={{ fontSize: '13px', color: '#999', marginBottom: '24px' }}>
                스팸함도 확인해보세요.
              </p>
              <a href="/login" style={{ display: 'block', textAlign: 'center', fontSize: '14px', color: '#e2a06e', textDecoration: 'none', fontWeight: 600 }}>
                로그인으로 돌아가기
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="가입한 이메일 입력"
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
                  marginBottom: '16px',
                }}
              >
                {loading ? '발송 중...' : '재설정 메일 발송'}
              </button>

              <a href="/login" style={{ display: 'block', textAlign: 'center', fontSize: '13px', color: '#999', textDecoration: 'none' }}>
                로그인으로 돌아가기
              </a>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
