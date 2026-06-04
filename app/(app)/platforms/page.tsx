'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Store } from 'lucide-react';

interface Platform { id: number; name: string; color: string; type: string; is_active: boolean; }

const PRESET_COLORS = ['#F8C42A','#8A2BE2','#FF6B35','#2874F0','#FF9900','#84C225','#E91E63','#00BCD4','#4CAF50','#FF5722','#6366f1','#ec4899'];
const TYPES = [{ v: 'online', l: 'Online Platform' }, { v: 'offline', l: 'Offline / Physical' }, { v: 'other', l: 'Other (Gift, B2B…)' }];

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Platform | null>(null);
  const [form, setForm] = useState({ name: '', color: '#6366f1', type: 'online', is_active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => { setLoading(true); const r = await fetch('/api/platforms'); setPlatforms(await r.json()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: '', color: '#6366f1', type: 'online', is_active: true }); setError(''); setModal(true); };
  const openEdit = (p: Platform) => { setEditing(p); setForm({ name: p.name, color: p.color, type: p.type, is_active: p.is_active }); setError(''); setModal(true); };

  const handleSave = async () => {
    setSaving(true); setError('');
    const url = editing ? `/api/platforms/${editing.id}` : '/api/platforms';
    const r = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!r.ok) { const d = await r.json(); setError(d.error || 'Error'); setSaving(false); return; }
    setModal(false); load(); setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this channel?')) return;
    await fetch(`/api/platforms/${id}`, { method: 'DELETE' }); load();
  };

  const grouped = TYPES.map(t => ({ ...t, items: platforms.filter(p => p.type === t.v) }));

  return (
    <div className="fade-up">
      <div className="page-hdr">
        <div>
          <div className="page-title">Sales Channels</div>
          <div className="page-sub">Manage online platforms, offline stores, and other channels</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={13} /> Add Channel</button>
      </div>

      {loading ? <div className="empty"><RefreshCw size={22} className="spin" style={{ color: 'var(--accent)' }} /></div> : (
        grouped.map(group => group.items.length > 0 && (
          <div key={group.v} style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.75rem' }}>{group.l}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '.75rem' }}>
              {group.items.map(p => (
                <div key={p.id} className="card card-sm" style={{ borderLeft: `4px solid ${p.color}`, opacity: p.is_active ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: p.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Store size={15} style={{ color: p.color }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '.875rem', color: 'var(--text1)' }}>{p.name}</div>
                        <div style={{ fontSize: '.65rem', color: 'var(--text3)', marginTop: 1 }}>{p.is_active ? 'Active' : 'Inactive'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '.25rem' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}><Pencil size={12} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)}><Trash2 size={12} style={{ color: 'var(--red)' }} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {modal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing ? 'Edit Channel' : 'Add Channel'}</div>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="label">Channel Name *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Swiggy Instamart" />
            </div>

            <div className="form-group">
              <label className="label">Type</label>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                {TYPES.map(t => (
                  <button key={t.v} onClick={() => setForm(f => ({...f, type: t.v}))}
                    style={{ flex: 1, padding: '.4rem .3rem', borderRadius: 'var(--r-sm)', border: `1.5px solid ${form.type === t.v ? 'var(--accent)' : 'var(--border)'}`, background: form.type === t.v ? 'var(--accent-bg)' : 'transparent', color: form.type === t.v ? 'var(--accent2)' : 'var(--text2)', fontSize: '.7rem', fontWeight: 700, cursor: 'pointer', transition: 'all .15s', textAlign: 'center' }}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="label">Brand Color</label>
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.5rem' }}>
                {PRESET_COLORS.map(c => (
                  <div key={c} onClick={() => setForm(f => ({...f, color: c}))}
                    style={{ width: 26, height: 26, borderRadius: 6, background: c, cursor: 'pointer', border: form.color === c ? '3px solid white' : '2px solid transparent', transition: 'all .15s', boxSizing: 'border-box' }} />
                ))}
              </div>
              <input type="color" value={form.color} onChange={e => setForm(f => ({...f, color: e.target.value}))}
                style={{ width: '100%', height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none' }} />
            </div>

            {editing && (
              <div className="form-group">
                <label className="label">Status</label>
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  {[{ v: true, l: 'Active' }, { v: false, l: 'Inactive' }].map(({ v, l }) => (
                    <button key={String(v)} onClick={() => setForm(f => ({...f, is_active: v}))}
                      style={{ flex: 1, padding: '.4rem', borderRadius: 'var(--r-sm)', border: `1.5px solid ${form.is_active === v ? 'var(--accent)' : 'var(--border)'}`, background: form.is_active === v ? 'var(--accent-bg)' : 'transparent', color: form.is_active === v ? 'var(--accent2)' : 'var(--text2)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 100, justifyContent: 'center' }}>{saving ? <><RefreshCw size={13} className="spin" />Saving…</> : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
