'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Package, TrendingUp } from 'lucide-react';

interface Product { id: number; name: string; sku: string; category: string | null; unit: string; low_stock_threshold: number; master_stock: number; }

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', sku: '', category: '', unit: 'pcs', low_stock_threshold: 10, master_stock: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => { setLoading(true); const r = await fetch('/api/products'); setProducts(await r.json()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: '', sku: '', category: '', unit: 'pcs', low_stock_threshold: 10, master_stock: 0 }); setError(''); setModal(true); };
  const openEdit = (p: Product) => { setEditing(p); setForm({ name: p.name, sku: p.sku, category: p.category || '', unit: p.unit, low_stock_threshold: p.low_stock_threshold, master_stock: p.master_stock }); setError(''); setModal(true); };

  const handleSave = async () => {
    setSaving(true); setError('');
    const url = editing ? `/api/products/${editing.id}` : '/api/products';
    const r = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!r.ok) { const d = await r.json(); setError(d.error || 'Error'); setSaving(false); return; }
    setModal(false); load(); setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete product and all its transaction history?')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' }); load();
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
  const totalStock = products.reduce((s, p) => s + p.master_stock, 0);
  const lowCount = products.filter(p => p.master_stock <= p.low_stock_threshold).length;

  return (
    <div className="fade-up">
      <div className="page-hdr">
        <div>
          <div className="page-title">Products & Master Stock</div>
          <div className="page-sub">{products.length} products · {totalStock} total units · {lowCount} low stock</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={13} /> Add Product</button>
      </div>

      <div className="filters">
        <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Search by name or SKU…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /></button>
      </div>

      {/* Stock overview cards */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '.75rem', marginBottom: '1.25rem' }}>
          {filtered.map(p => {
            const pct = Math.min(100, p.master_stock / Math.max(p.low_stock_threshold * 3, 1) * 100);
            const color = p.master_stock === 0 ? 'var(--red)' : p.master_stock <= p.low_stock_threshold ? 'var(--yellow)' : 'var(--green)';
            return (
              <div key={p.id} className="card card-sm" style={{ borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.5rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '.65rem', color: 'var(--text3)' }}>{p.sku} · {p.category || 'No category'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '.25rem', flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}><Pencil size={12} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(p.id)}><Trash2 size={12} style={{ color: 'var(--red)' }} /></button>
                  </div>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1 }}>{p.master_stock} <span style={{ fontSize: '.7rem', fontWeight: 500, color: 'var(--text3)' }}>{p.unit}</span></div>
                <div className="bar-track" style={{ marginTop: '.5rem' }}><div className="bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
                <div style={{ fontSize: '.65rem', color: 'var(--text3)', marginTop: '.2rem' }}>Alert at {p.low_stock_threshold}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table view */}
      <div className="card card-0">
        {loading ? <div className="empty"><RefreshCw size={22} className="spin" style={{ color: 'var(--accent)' }} /></div>
          : filtered.length === 0 ? <div className="empty"><Package size={32} /><div style={{ marginTop: '.5rem' }}>{search ? 'No products match your search' : 'No products yet'}</div></div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Product</th><th>SKU</th><th>Category</th><th>Unit</th><th>Master Stock</th><th>Low Alert</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text1)' }}>{p.name}</td>
                      <td><span className="badge badge-purple">{p.sku}</span></td>
                      <td style={{ color: 'var(--text3)' }}>{p.category || '—'}</td>
                      <td>{p.unit}</td>
                      <td>
                        <span style={{ fontWeight: 800, fontSize: '.95rem', color: p.master_stock === 0 ? 'var(--red)' : p.master_stock <= p.low_stock_threshold ? 'var(--yellow)' : 'var(--text1)' }}>
                          {p.master_stock}
                        </span>
                      </td>
                      <td>{p.low_stock_threshold}</td>
                      <td>
                        {p.master_stock === 0 ? <span className="badge badge-danger">Out of Stock</span>
                          : p.master_stock <= p.low_stock_threshold ? <span className="badge badge-warning">Low Stock</span>
                          : <span className="badge badge-success">In Stock</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '.3rem' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}><Pencil size={12} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}><Trash2 size={12} /></button>
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
            <div className="modal-title">{editing ? 'Edit Product' : 'Add Product'}</div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-row">
              <div className="form-group"><label className="label">Product Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Organic Milk" /></div>
              <div className="form-group"><label className="label">SKU *</label><input className="input" value={form.sku} onChange={e => setForm(f => ({...f, sku: e.target.value}))} placeholder="MLK-001" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="label">Category</label><input className="input" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} placeholder="e.g. Dairy" /></div>
              <div className="form-group"><label className="label">Unit</label>
                <select className="input" value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))}>
                  {['pcs','kg','g','L','mL','pack','box','dozen','pair','bottle'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="label">Opening Master Stock</label>
                <input type="number" className="input" value={form.master_stock} onChange={e => setForm(f => ({...f, master_stock: parseInt(e.target.value)||0}))} />
                <div style={{ fontSize: '.65rem', color: 'var(--text3)', marginTop: '.25rem' }}>Current physical stock you have</div>
              </div>
              <div className="form-group"><label className="label">Low Stock Alert At</label><input type="number" className="input" value={form.low_stock_threshold} onChange={e => setForm(f => ({...f, low_stock_threshold: parseInt(e.target.value)||0}))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 110, justifyContent: 'center' }}>{saving ? <><RefreshCw size={13} className="spin" />Saving…</> : 'Save Product'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
