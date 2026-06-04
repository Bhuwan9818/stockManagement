'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Users, Shield, User, Eye, EyeOff } from 'lucide-react';

interface UserRow {
  id: number; name: string; email: string; role: string;
  is_active: boolean; created_at: string; last_login: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager', is_active: true });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [me, setMe] = useState<{ role: string; userId: number } | null>(null);

  const load = async () => {
    setLoading(true);
    const [usersRes, meRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/auth/me'),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (meRes.ok) { const d = await meRes.json(); setMe({ role: d.user.role, userId: d.user.userId }); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'manager', is_active: true });
    setError(''); setShowPass(false); setModal(true);
  };
  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, is_active: u.is_active });
    setError(''); setShowPass(false); setModal(true);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    const url = editing ? `/api/users/${editing.id}` : '/api/users';
    const method = editing ? 'PUT' : 'POST';
    const body = { ...form };
    if (editing && !body.password) delete (body as { password?: string }).password;
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { const d = await r.json(); setError(d.error || 'Error'); setSaving(false); return; }
    setModal(false); load(); setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user? They will lose access immediately.')) return;
    const r = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!r.ok) { const d = await r.json(); alert(d.error); return; }
    load();
  };

  const admins = users.filter(u => u.role === 'admin');
  const managers = users.filter(u => u.role === 'manager');

  return (
    <div className="fade-up">
      <div className="page-hdr">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-sub">{users.length} users · {admins.length} admin{admins.length !== 1 ? 's' : ''} · {managers.length} manager{managers.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={13} /> Add User</button>
      </div>

      {/* Role legend */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { role: 'admin', icon: Shield, color: 'var(--accent2)', bg: 'var(--accent-bg)', desc: 'Full access — can manage users, all stock operations' },
          { role: 'manager', icon: User, color: 'var(--green)', bg: 'rgba(34,197,94,.1)', desc: 'Can manage stock, transactions, products, platforms' },
        ].map(({ role, icon: Icon, color, bg, desc }) => (
          <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.5rem .875rem', background: bg, borderRadius: 8, border: `1px solid ${color}30` }}>
            <Icon size={13} style={{ color }} />
            <div>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color, textTransform: 'capitalize' }}>{role}</div>
              <div style={{ fontSize: '.65rem', color: 'var(--text3)' }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card card-0">
        {loading ? <div className="empty"><RefreshCw size={22} className="spin" style={{ color: 'var(--accent)' }} /></div>
          : users.length === 0 ? <div className="empty"><Users size={32} /><div style={{ marginTop: '.5rem' }}>No users yet</div></div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Created</th><th></th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            background: u.role === 'admin' ? 'var(--accent-bg)' : 'rgba(34,197,94,.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {u.role === 'admin'
                              ? <Shield size={13} style={{ color: 'var(--accent2)' }} />
                              : <User size={13} style={{ color: 'var(--green)' }} />}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text1)', fontSize: '.85rem' }}>{u.name}</span>
                          {me?.userId === u.id && <span className="badge badge-purple" style={{ fontSize: '.6rem' }}>You</span>}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text3)', fontSize: '.8rem' }}>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-success'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
                        {u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                      </td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
                        {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '.3rem' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}><Pencil size={12} /></button>
                          {me?.userId !== u.id && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}><Trash2 size={12} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {modal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing ? 'Edit User' : 'Add New User'}</div>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-row">
              <div className="form-group">
                <label className="label">Full Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Rahul Sharma" />
              </div>
              <div className="form-group">
                <label className="label">Role</label>
                <div style={{ display: 'flex', gap: '.4rem' }}>
                  {[{ v: 'manager', l: 'Manager', c: 'var(--green)' }, { v: 'admin', l: 'Admin', c: 'var(--accent2)' }].map(({ v, l, c }) => (
                    <button key={v} onClick={() => setForm(f => ({...f, role: v}))}
                      style={{ flex: 1, padding: '.45rem', borderRadius: 'var(--r-sm)', border: `1.5px solid ${form.role === v ? c : 'var(--border)'}`, background: form.role === v ? c + '18' : 'transparent', color: form.role === v ? c : 'var(--text2)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="label">Email Address *</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="user@company.com" />
            </div>

            <div className="form-group">
              <label className="label">{editing ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} className="input"
                  value={form.password}
                  onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  placeholder={editing ? '••••••••' : 'Min 6 characters'}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  style={{ position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0 }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {editing && (
              <div className="form-group">
                <label className="label">Account Status</label>
                <div style={{ display: 'flex', gap: '.4rem' }}>
                  {[{ v: true, l: 'Active' }, { v: false, l: 'Inactive (block login)' }].map(({ v, l }) => (
                    <button key={String(v)} onClick={() => setForm(f => ({...f, is_active: v}))}
                      style={{ flex: 1, padding: '.45rem', borderRadius: 'var(--r-sm)', border: `1.5px solid ${form.is_active === v ? (v ? 'var(--green)' : 'var(--red)') : 'var(--border)'}`, background: form.is_active === v ? (v ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)') : 'transparent', color: form.is_active === v ? (v ? 'var(--green)' : 'var(--red)') : 'var(--text2)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 110, justifyContent: 'center' }}>
                {saving ? <><RefreshCw size={13} className="spin" />Saving…</> : editing ? 'Update User' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
