'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Trash2, RefreshCw, ClipboardList } from 'lucide-react';

interface Product { id: number; name: string; sku: string; master_stock: number; }
interface Platform { id: number; name: string; color: string; type: string; }
interface Txn {
  id: number; type: string; product_name: string; product_sku: string;
  platform_name: string | null; platform_color: string | null;
  quantity: number; direction: number; transaction_date: string;
  notes: string | null; supplier: string | null; cost_per_unit: number | null;
}

const TYPES = [
  { value: 'sale',         label: 'Platform Sale',  color: 'var(--red)',     needsPlatform: true,  dir: -1 },
  { value: 'return',       label: 'Return',          color: 'var(--blue)',    needsPlatform: true,  dir:  1 },
  { value: 'restock',      label: 'Restock',         color: 'var(--green)',   needsPlatform: false, dir:  1 },
  { value: 'offline_sale', label: 'Offline Sale',    color: 'var(--yellow)',  needsPlatform: false, dir: -1 },
  { value: 'gift',         label: 'Gift / Sample',   color: 'var(--pink)',    needsPlatform: false, dir: -1 },
  { value: 'adjustment',   label: 'Adjustment',      color: 'var(--accent2)', needsPlatform: false, dir:  0 },
];

const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.value, t]));

function TransactionsInner() {
  const searchParams = useSearchParams();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [activeType, setActiveType] = useState('all');
  const [filters, setFilters] = useState({ start: '', end: '', platform_id: '', product_id: '' });
  const [form, setForm] = useState({
    product_id: '', platform_id: '', type: 'sale', quantity: '',
    transaction_date: new Date().toISOString().split('T')[0],
    notes: '', supplier: '', cost_per_unit: '', adjustment_direction: 'add',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchTxns = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filters.start) p.set('start', filters.start);
    if (filters.end) p.set('end', filters.end);
    if (filters.platform_id) p.set('platform_id', filters.platform_id);
    if (filters.product_id) p.set('product_id', filters.product_id);
    if (activeType !== 'all') p.set('type', activeType);
    const r = await fetch('/api/transactions?' + p);
    setTxns(await r.json());
    setLoading(false);
  }, [filters, activeType]);

  useEffect(() => {
    fetchTxns();
    fetch('/api/products').then(r => r.json()).then(setProducts);
    fetch('/api/platforms').then(r => r.json()).then(setPlatforms);
  }, [fetchTxns]);

  // open modal from query param
  useEffect(() => {
    const action = searchParams.get('action');
    if (action && TYPES.find(t => t.value === action)) {
      setForm(f => ({ ...f, type: action }));
      setError('');
      setModal(true);
    }
  }, [searchParams]);

  const openModal = (type = 'sale') => {
    setForm({ product_id: '', platform_id: '', type, quantity: '', transaction_date: new Date().toISOString().split('T')[0], notes: '', supplier: '', cost_per_unit: '', adjustment_direction: 'add' });
    setError(''); setModal(true);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    if (!form.product_id || !form.quantity) { setError('Product and quantity are required'); setSaving(false); return; }
    const meta = TYPE_MAP[form.type];
    if (meta?.needsPlatform && !form.platform_id) { setError('Please select a platform'); setSaving(false); return; }

    const r = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, product_id: parseInt(form.product_id), platform_id: form.platform_id ? parseInt(form.platform_id) : null, quantity: parseInt(form.quantity) }),
    });
    if (!r.ok) { const d = await r.json(); setError(d.error || 'Error'); setSaving(false); return; }
    setModal(false); fetchTxns();
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this entry? Stock will be reversed.')) return;
    await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' });
    fetchTxns();
  };

  const meta = TYPE_MAP[form.type];
  const totalIn = txns.filter(t => t.direction === 1).reduce((s, t) => s + t.quantity, 0);
  const totalOut = txns.filter(t => t.direction === -1).reduce((s, t) => s + t.quantity, 0);

  return (
    <div className="fade-up">
      <div className="page-hdr">
        <div>
          <div className="page-title">Transactions</div>
          <div className="page-sub">{txns.length} entries · <span style={{ color: 'var(--green)' }}>+{totalIn}</span> in · <span style={{ color: 'var(--red)' }}>-{totalOut}</span> out</div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}><Plus size={13} /> Add Entry</button>
      </div>

      {/* Type filter chips */}
      <div className="chip-row" style={{ marginBottom: '1rem' }}>
        {[{ value: 'all', label: 'All' }, ...TYPES].map(t => (
          <button key={t.value} className={`chip ${activeType === t.value ? 'active' : ''}`} onClick={() => setActiveType(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="filters">
        <input type="date" className="input" style={{ width: 145 }} value={filters.start} onChange={e => setFilters(f => ({...f, start: e.target.value}))} placeholder="From" />
        <input type="date" className="input" style={{ width: 145 }} value={filters.end} onChange={e => setFilters(f => ({...f, end: e.target.value}))} placeholder="To" />
        <select className="input" style={{ width: 160 }} value={filters.platform_id} onChange={e => setFilters(f => ({...f, platform_id: e.target.value}))}>
          <option value="">All Platforms</option>
          {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input" style={{ width: 175 }} value={filters.product_id} onChange={e => setFilters(f => ({...f, product_id: e.target.value}))}>
          <option value="">All Products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ start: '', end: '', platform_id: '', product_id: '' })}>Clear</button>
      </div>

      <div className="card card-0">
        {loading ? <div className="empty"><RefreshCw size={22} className="spin" style={{ color: 'var(--accent)' }} /></div>
          : txns.length === 0 ? <div className="empty"><ClipboardList size={32} /><div style={{ marginTop: '.5rem' }}>No entries found</div></div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Product</th><th>Type / Channel</th><th>Stock Change</th><th>Notes</th><th></th></tr>
                </thead>
                <tbody>
                  {txns.map(t => {
                    const tm = TYPE_MAP[t.type];
                    return (
                      <tr key={t.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(t.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text1)', fontSize: '.8rem' }}>{t.product_name}</div>
                          <div style={{ fontSize: '.65rem', color: 'var(--text3)' }}>{t.product_sku}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                            <span style={{ fontSize: '.7rem', fontWeight: 700, color: tm?.color || 'var(--text2)', background: (tm?.color || 'var(--text2)') + '18', padding: '.1rem .45rem', borderRadius: 999 }}>
                              {tm?.label || t.type}
                            </span>
                          </div>
                          {t.platform_name && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem', marginTop: '.2rem' }}>
                              <span className="dot" style={{ background: t.platform_color || '#888', width: 7, height: 7 }} />
                              <span style={{ fontSize: '.7rem', color: 'var(--text3)' }}>{t.platform_name}</span>
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, fontSize: '.9rem', color: t.direction === 1 ? 'var(--green)' : 'var(--red)' }}>
                            {t.direction === 1 ? '+' : '-'}{t.quantity}
                          </span>
                        </td>
                        <td style={{ maxWidth: 160, fontSize: '.75rem', color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.supplier ? `📦 ${t.supplier}` : t.notes || '—'}
                        </td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t.id)}><Trash2 size={13} style={{ color: 'var(--red)' }} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Add Modal */}
      {modal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-title">Add Stock Entry</div>
            {error && <div className="alert alert-error">{error}</div>}

            {/* Type selector */}
            <div className="form-group">
              <label className="label">Transaction Type *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '.4rem' }}>
                {TYPES.map(t => (
                  <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
                    style={{ padding: '.45rem .5rem', borderRadius: 'var(--r-sm)', border: `1.5px solid ${form.type === t.value ? t.color : 'var(--border)'}`, background: form.type === t.value ? t.color + '18' : 'transparent', color: form.type === t.value ? t.color : 'var(--text2)', fontSize: '.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="label">Product *</label>
                <select className="input" value={form.product_id} onChange={e => setForm(f => ({...f, product_id: e.target.value}))}>
                  <option value="">Select…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.master_stock} in stock</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Quantity *</label>
                <input type="number" className="input" min={1} value={form.quantity} onChange={e => setForm(f => ({...f, quantity: e.target.value}))} placeholder="0" />
              </div>
            </div>

            {meta?.needsPlatform && (
              <div className="form-group">
                <label className="label">Platform *</label>
                <select className="input" value={form.platform_id} onChange={e => setForm(f => ({...f, platform_id: e.target.value}))}>
                  <option value="">Select platform…</option>
                  {platforms.filter(p => p.type === 'online').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            {form.type === 'adjustment' && (
              <div className="form-group">
                <label className="label">Direction</label>
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  {[{ v: 'add', l: '+ Add to Stock', c: 'var(--green)' }, { v: 'deduct', l: '- Deduct from Stock', c: 'var(--red)' }].map(({ v, l, c }) => (
                    <button key={v} onClick={() => setForm(f => ({...f, adjustment_direction: v}))}
                      style={{ flex: 1, padding: '.45rem', borderRadius: 'var(--r-sm)', border: `1.5px solid ${form.adjustment_direction === v ? c : 'var(--border)'}`, background: form.adjustment_direction === v ? c + '18' : 'transparent', color: form.adjustment_direction === v ? c : 'var(--text2)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="label">Date</label>
                <input type="date" className="input" value={form.transaction_date} onChange={e => setForm(f => ({...f, transaction_date: e.target.value}))} />
              </div>
              {form.type === 'restock' ? (
                <div className="form-group">
                  <label className="label">Cost per Unit (₹)</label>
                  <input type="number" className="input" value={form.cost_per_unit} onChange={e => setForm(f => ({...f, cost_per_unit: e.target.value}))} placeholder="0.00" step="0.01" />
                </div>
              ) : <div />}
            </div>

            {form.type === 'restock' && (
              <div className="form-group">
                <label className="label">Supplier</label>
                <input className="input" value={form.supplier} onChange={e => setForm(f => ({...f, supplier: e.target.value}))} placeholder="Supplier name (optional)" />
              </div>
            )}

            <div className="form-group">
              <label className="label">Notes (optional)</label>
              <input className="input" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Any notes…" />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ background: meta?.color, minWidth: 120, justifyContent: 'center' }}>
                {saving ? <><RefreshCw size={13} className="spin" /> Saving…</> : `Save ${meta?.label || 'Entry'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return <Suspense><TransactionsInner /></Suspense>;
}
