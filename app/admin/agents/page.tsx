'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Agent = {
  id: string;
  name: string;
  role: string;
  phone: string;
  kakao_url: string | null;
  is_active: boolean;
  created_at: string;
};

const EMPTY_FORM = { name: '', role: '', phone: '', kakao_url: '' };

const inputSt: React.CSSProperties = {
  width: '100%', height: '36px', border: '1px solid #ddd', borderRadius: '4px',
  padding: '0 10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
};

export default function AgentsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login?redirect=/admin/agents'); return; }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    fetchAgents();
  }, [authChecked]);

  const fetchAgents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: true });
    setAgents(data ?? []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) { alert('이름을 입력하세요.'); return; }
    if (!addForm.phone.trim()) { alert('전화번호를 입력하세요.'); return; }
    setAdding(true);
    const { error } = await supabase.from('agents').insert({
      name: addForm.name.trim(),
      role: addForm.role.trim() || '공인중개사',
      phone: addForm.phone.trim(),
      kakao_url: addForm.kakao_url.trim() || null,
      is_active: true,
    });
    setAdding(false);
    if (error) { alert(`등록 실패: ${error.message}`); return; }
    setAddForm(EMPTY_FORM);
    fetchAgents();
  };

  const startEdit = (a: Agent) => {
    setEditId(a.id);
    setEditForm({ name: a.name, role: a.role, phone: a.phone, kakao_url: a.kakao_url ?? '' });
  };

  const cancelEdit = () => { setEditId(null); setEditForm(EMPTY_FORM); };

  const handleSave = async (id: string) => {
    if (!editForm.name.trim()) { alert('이름을 입력하세요.'); return; }
    if (!editForm.phone.trim()) { alert('전화번호를 입력하세요.'); return; }
    const { error } = await supabase.from('agents').update({
      name: editForm.name.trim(),
      role: editForm.role.trim() || '공인중개사',
      phone: editForm.phone.trim(),
      kakao_url: editForm.kakao_url.trim() || null,
    }).eq('id', id);
    if (error) { alert(`수정 실패: ${error.message}`); return; }
    setEditId(null);
    fetchAgents();
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('agents').update({ is_active: !current }).eq('id', id);
    if (error) { alert(`상태 변경 실패: ${error.message}`); return; }
    setAgents(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a));
  };

  if (!authChecked) return null;

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '24px 16px 80px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => router.push('/admin')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: '20px', padding: '0', lineHeight: 1 }}
        >←</button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>담당자 관리</h1>
      </div>

      {/* 담당자 추가 폼 */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#c47c30', marginBottom: '12px' }}>+ 담당자 추가</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>이름 *</label>
            <input
              style={inputSt}
              placeholder="홍길동"
              value={addForm.name}
              onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>직함</label>
            <input
              style={inputSt}
              placeholder="공인중개사"
              value={addForm.role}
              onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>전화번호 *</label>
            <input
              style={inputSt}
              placeholder="010-0000-0000"
              value={addForm.phone}
              onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>카카오톡 오픈채팅 URL</label>
            <input
              style={inputSt}
              placeholder="https://open.kakao.com/..."
              value={addForm.kakao_url}
              onChange={e => setAddForm(f => ({ ...f, kakao_url: e.target.value }))}
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={adding}
          style={{ padding: '8px 20px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer', opacity: adding ? 0.6 : 1 }}
        >
          {adding ? '등록 중...' : '등록'}
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999', fontSize: '14px' }}>로딩 중...</div>
      ) : agents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999', fontSize: '14px' }}>등록된 담당자가 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {agents.map(a => (
            <div
              key={a.id}
              style={{
                background: '#fff', border: `1px solid ${a.is_active ? '#e0e0e0' : '#f0f0f0'}`,
                borderRadius: '8px', padding: '14px 16px',
                opacity: a.is_active ? 1 : 0.55,
              }}
            >
              {editId === a.id ? (
                /* 수정 모드 */
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>이름</label>
                      <input style={inputSt} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>직함</label>
                      <input style={inputSt} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>전화번호</label>
                      <input style={inputSt} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '3px' }}>카카오 URL</label>
                      <input style={inputSt} value={editForm.kakao_url} onChange={e => setEditForm(f => ({ ...f, kakao_url: e.target.value }))} placeholder="https://open.kakao.com/..." />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleSave(a.id)} style={{ padding: '6px 16px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>저장</button>
                    <button onClick={cancelEdit} style={{ padding: '6px 16px', background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>취소</button>
                  </div>
                </>
              ) : (
                /* 표시 모드 */
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>{a.name}</span>
                      <span style={{ fontSize: '12px', color: '#888' }}>{a.role}</span>
                      {!a.is_active && (
                        <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#999', borderRadius: '10px', padding: '1px 8px' }}>비활성</span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: '#c47c30', marginTop: '3px', fontWeight: 600 }}>{a.phone}</div>
                    {a.kakao_url && (
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        💛 {a.kakao_url}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => startEdit(a)}
                      style={{ padding: '5px 12px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', color: '#444', cursor: 'pointer' }}
                    >수정</button>
                    <button
                      onClick={() => toggleActive(a.id, a.is_active)}
                      style={{
                        padding: '5px 12px', border: 'none', borderRadius: '4px', fontSize: '12px',
                        fontWeight: 600, cursor: 'pointer',
                        background: a.is_active ? '#fee2e2' : '#dcfce7',
                        color: a.is_active ? '#991b1b' : '#166534',
                      }}
                    >
                      {a.is_active ? '비활성화' : '활성화'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
