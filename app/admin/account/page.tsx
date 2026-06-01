'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/account'); return; }
      setEmail(data.user.email ?? '');
      setAuthChecked(true);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('새 비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    // 현재 비밀번호로 재인증
    const { error: reAuthErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reAuthErr) {
      setError('현재 비밀번호가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    // 새 비밀번호로 변경
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateErr) {
      setError('비밀번호 변경에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    setSuccess('비밀번호가 변경되었습니다.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        확인 중...
      </div>
    );
  }

  return (
    <main style={{ background: '#f5f5f5', minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/admin" style={{ color: '#999', textDecoration: 'none', fontSize: '14px' }}>← 관리자</a>
          <span style={{ color: '#ddd' }}>/</span>
          <span style={{ fontSize: '14px', color: '#333', fontWeight: 600 }}>내 계정</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 24px' }}>비밀번호 변경</h1>

          {/* 이메일 표시 */}
          <div style={{ marginBottom: '24px', padding: '12px 16px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee' }}>
            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>계정 이메일</div>
            <div style={{ fontSize: '15px', color: '#333', fontWeight: 500 }}>{email}</div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>현재 비밀번호</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="현재 비밀번호 입력"
                required
                style={{ width: '100%', height: '44px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>새 비밀번호</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="8자 이상 입력"
                required
                style={{ width: '100%', height: '44px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>새 비밀번호 확인</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호 다시 입력"
                required
                style={{ width: '100%', height: '44px', border: '1px solid #ddd', borderRadius: '6px', padding: '0 12px', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {error && (
              <p style={{ fontSize: '13px', color: '#e05050', marginBottom: '16px', padding: '10px 14px', background: '#fff5f5', borderRadius: '6px', border: '1px solid #ffd0d0' }}>{error}</p>
            )}
            {success && (
              <p style={{ fontSize: '13px', color: '#2e7d32', marginBottom: '16px', padding: '10px 14px', background: '#f0f9f0', borderRadius: '6px', border: '1px solid #c8e6c9' }}>{success}</p>
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
        </div>
      </div>
    </main>
  );
}
