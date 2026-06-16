'use client';
import { useEffect, useState, useCallback } from 'react';
import { Download, RefreshCw, BarChart3, TrendingDown, TrendingUp, Package, Calendar, FileDown } from 'lucide-react';

interface Platform { id: number; name: string; color: string; }
interface Product  { id: number; name: string; sku: string; }
interface Txn {
  type: string; direction: number; quantity: number; transaction_date: string;
  product_name: string; product_sku: string; platform_name: string | null; platform_color: string | null;
}

const EXPORT_TYPES = [
  { v: 'all',          l: 'Complete Report (All Sheets)' },
  { v: 'transactions', l: 'All Transactions' },
  { v: 'stock',        l: 'Current Stock' },
  { v: 'platform',     l: 'Platform Sales & Returns' },
  { v: 'monthly',      l: 'Monthly Summary' },
  { v: 'datewise',     l: 'Date-wise Summary' },
  { v: 'product',      l: 'Product Summary' },
];

// Quick preset helpers
function monthRange(offsetMonths: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const last = new Date(y, d.getMonth() + 1, 0).getDate();
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${last}` };
}

export default function ReportsPage() {
  const [txns, setTxns]         = useState<Txn[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(false);
  const [exporting, setExporting] = useState(false);

  // Dashboard view filters (affect the charts/tables on screen)
  const [viewFilters, setViewFilters] = useState({ start: '', end: '', platform_id: '', product_id: '' });

  // Download filters (affect what goes into the Excel file)
  const [dlFilters, setDlFilters] = useState({ start: '', end: '', platform_id: '', product_id: '', exportType: 'all' });

  useEffect(() => {
    fetch('/api/platforms').then(r => r.json()).then(setPlatforms);
    fetch('/api/products').then(r => r.json()).then(setProducts);
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (viewFilters.start)       p.set('start',       viewFilters.start);
    if (viewFilters.end)         p.set('end',         viewFilters.end);
    if (viewFilters.platform_id) p.set('platform_id', viewFilters.platform_id);
    if (viewFilters.product_id)  p.set('product_id',  viewFilters.product_id);
    const r = await fetch('/api/transactions?' + p);
    setTxns(await r.json());
    setLoading(false);
  }, [viewFilters]);

  const handleExport = async () => {
    setExporting(true);
    const p = new URLSearchParams({ type: dlFilters.exportType });
    if (dlFilters.start)       p.set('start',       dlFilters.start);
    if (dlFilters.end)         p.set('end',         dlFilters.end);
    if (dlFilters.platform_id) p.set('platform_id', dlFilters.platform_id);
    if (dlFilters.product_id)  p.set('product_id',  dlFilters.product_id);
    const r = await fetch('/api/export?' + p);
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    const label = dlFilters.start && dlFilters.end
      ? `${dlFilters.start}_to_${dlFilters.end}`
      : new Date().toISOString().split('T')[0];
    a.download = `stockflow-${dlFilters.exportType}-${label}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const applyPreset = (preset: 'thisMonth' | 'lastMonth' | 'all') => {
    if (preset === 'all')       setDlFilters(f => ({ ...f, start: '', end: '' }));
    else if (preset === 'thisMonth')  setDlFilters(f => ({ ...f, ...monthRange(0) }));
    else if (preset === 'lastMonth')  setDlFilters(f => ({ ...f, ...monthRange(-1) }));
  };

  // ── Derived stats from view data ──────────────────────────────────────────
  const totalIn      = txns.filter(t => t.direction === 1).reduce((s, t) => s + t.quantity, 0);
  const totalOut     = txns.filter(t => t.direction === -1).reduce((s, t) => s + t.quantity, 0);
  const totalSales   = txns.filter(t => t.type === 'sale').reduce((s, t) => s + t.quantity, 0);
  const totalReturns = txns.filter(t => t.type === 'return').reduce((s, t) => s + t.quantity, 0);
  const totalOffline = txns.filter(t => t.type === 'offline_sale').reduce((s, t) => s + t.quantity, 0);
  const totalGifts   = txns.filter(t => t.type === 'gift').reduce((s, t) => s + t.quantity, 0);
  const totalRestock = txns.filter(t => t.type === 'restock').reduce((s, t) => s + t.quantity, 0);

  const monthMap: Record<string, { in: number; out: number; sale: number; ret: number; offline: number; gift: number; restock: number }> = {};
  txns.forEach(t => {
    const m = t.transaction_date?.slice(0, 7) || '';
    if (!monthMap[m]) monthMap[m] = { in: 0, out: 0, sale: 0, ret: 0, offline: 0, gift: 0, restock: 0 };
    if (t.direction === 1) monthMap[m].in += t.quantity; else monthMap[m].out += t.quantity;
    if (t.type === 'sale')         monthMap[m].sale    += t.quantity;
    if (t.type === 'return')       monthMap[m].ret     += t.quantity;
    if (t.type === 'offline_sale') monthMap[m].offline += t.quantity;
    if (t.type === 'gift')         monthMap[m].gift    += t.quantity;
    if (t.type === 'restock')      monthMap[m].restock += t.quantity;
  });
  const months = Object.entries(monthMap).sort((a, b) => b[0].localeCompare(a[0]));

  const platMap: Record<string, { name: string; color: string; sale: number; ret: number }> = {};
  txns.forEach(t => {
    if (!t.platform_name) return;
    if (!platMap[t.platform_name]) platMap[t.platform_name] = { name: t.platform_name, color: t.platform_color || '#888', sale: 0, ret: 0 };
    if (t.type === 'sale')   platMap[t.platform_name].sale += t.quantity;
    if (t.type === 'return') platMap[t.platform_name].ret  += t.quantity;
  });
  const platRows = Object.values(platMap).sort((a, b) => b.sale - a.sale);

  const prodMap: Record<string, { name: string; sku: string; out: number; ret: number; restock: number }> = {};
  txns.forEach(t => {
    if (!prodMap[t.product_name]) prodMap[t.product_name] = { name: t.product_name, sku: t.product_sku, out: 0, ret: 0, restock: 0 };
    if (t.direction === -1)    prodMap[t.product_name].out     += t.quantity;
    if (t.type === 'return')   prodMap[t.product_name].ret     += t.quantity;
    if (t.type === 'restock')  prodMap[t.product_name].restock += t.quantity;
  });
  const prodRows = Object.values(prodMap).sort((a, b) => b.out - a.out);
  const maxOut = Math.max(...prodRows.map(p => p.out), 1);

  const dlLabel = dlFilters.start && dlFilters.end
    ? `${dlFilters.start}  →  ${dlFilters.end}`
    : dlFilters.start ? `From ${dlFilters.start}`
    : dlFilters.end   ? `Up to ${dlFilters.end}`
    : 'All time (no date filter)';

  return (
    <div className="fade-up">
      <div className="page-hdr">
        <div>
          <div className="page-title">Reports & Export</div>
          <div className="page-sub">Analyze stock movements and download data</div>
        </div>
      </div>

      {/* ── Dashboard view filters ─────────────────────────────────────────── */}
      <div className="card card-sm" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="label">View From</label>
            <input type="date" className="input" style={{ width: 145 }} value={viewFilters.start}
              onChange={e => setViewFilters(f => ({ ...f, start: e.target.value }))} />
          </div>
          <div>
            <label className="label">View To</label>
            <input type="date" className="input" style={{ width: 145 }} value={viewFilters.end}
              onChange={e => setViewFilters(f => ({ ...f, end: e.target.value }))} />
          </div>
          <div>
            <label className="label">Platform</label>
            <select className="input" style={{ width: 150 }} value={viewFilters.platform_id}
              onChange={e => setViewFilters(f => ({ ...f, platform_id: e.target.value }))}>
              <option value="">All Platforms</option>
              {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Product</label>
            <select className="input" style={{ width: 160 }} value={viewFilters.product_id}
              onChange={e => setViewFilters(f => ({ ...f, product_id: e.target.value }))}>
              <option value="">All Products</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Apply
          </button>
        </div>
      </div>

      {/* ── Download / Export card ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.25rem', border: '1.5px solid var(--accent)', background: 'var(--surface)' }}>
        {/* Card header */}
        <div style={{ padding: '.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <FileDown size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: '.875rem', color: 'var(--text1)' }}>Download Excel Report</span>
        </div>

        <div style={{ padding: '.875rem 1rem' }}>
          {/* Preset quick-select buttons */}
          <div style={{ display: 'flex', gap: '.4rem', marginBottom: '.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.75rem', color: 'var(--text3)', alignSelf: 'center', marginRight: '.2rem' }}>Quick select:</span>
            <button className="btn btn-secondary" style={{ fontSize: '.75rem', padding: '3px 10px' }}
              onClick={() => applyPreset('thisMonth')}>This Month</button>
            <button className="btn btn-secondary" style={{ fontSize: '.75rem', padding: '3px 10px' }}
              onClick={() => applyPreset('lastMonth')}>Last Month</button>
            <button className="btn btn-secondary" style={{ fontSize: '.75rem', padding: '3px 10px' }}
              onClick={() => applyPreset('all')}>All Time</button>
          </div>

          {/* Date range row */}
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                <Calendar size={11} /> Report From
              </label>
              <input type="date" className="input" style={{ width: 150 }} value={dlFilters.start}
                onChange={e => setDlFilters(f => ({ ...f, start: e.target.value }))} />
            </div>
            <div>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                <Calendar size={11} /> Report To
              </label>
              <input type="date" className="input" style={{ width: 150 }} value={dlFilters.end}
                onChange={e => setDlFilters(f => ({ ...f, end: e.target.value }))} />
            </div>
            <div>
              <label className="label">Platform Filter</label>
              <select className="input" style={{ width: 150 }} value={dlFilters.platform_id}
                onChange={e => setDlFilters(f => ({ ...f, platform_id: e.target.value }))}>
                <option value="">All Platforms</option>
                {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Product Filter</label>
              <select className="input" style={{ width: 160 }} value={dlFilters.product_id}
                onChange={e => setDlFilters(f => ({ ...f, product_id: e.target.value }))}>
                <option value="">All Products</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Report Type</label>
              <select className="input" style={{ width: 215 }} value={dlFilters.exportType}
                onChange={e => setDlFilters(f => ({ ...f, exportType: e.target.value }))}>
                {EXPORT_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleExport} disabled={exporting}
              style={{ height: 36, whiteSpace: 'nowrap' }}>
              {exporting
                ? <><RefreshCw size={13} className="spin" /> Exporting…</>
                : <><Download size={13} /> Download Excel</>}
            </button>
          </div>

          {/* Selected range indicator */}
          <div style={{ marginTop: '.6rem', fontSize: '.75rem', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <span>📅</span>
            <span>Will download: <strong style={{ color: 'var(--text2)' }}>{dlLabel}</strong></span>
          </div>
        </div>
      </div>

      {/* ── Summary stats ──────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { n: totalRestock,         l: 'Restocked',       c: 'var(--green)',  icon: TrendingUp   },
          { n: totalSales,           l: 'Platform Sales',  c: 'var(--red)',    icon: TrendingDown },
          { n: totalReturns,         l: 'Returns',         c: 'var(--blue)',   icon: TrendingUp   },
          { n: totalOffline,         l: 'Offline Sales',   c: 'var(--yellow)', icon: TrendingDown },
          { n: totalGifts,           l: 'Gifts / Samples', c: 'var(--pink)',   icon: TrendingDown },
          { n: totalIn - totalOut,   l: 'Net Change',      c: (totalIn - totalOut) >= 0 ? 'var(--green)' : 'var(--red)', icon: BarChart3 },
        ].map(({ n, l, c, icon: Icon }) => (
          <div key={l} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-num" style={{ color: c, fontSize: '1.5rem' }}>{Math.abs(n)}</div>
                <div className="stat-lbl">{l}</div>
              </div>
              <Icon size={15} style={{ color: c }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid2" style={{ gap: '1rem', marginBottom: '1rem' }}>
        {/* Product performance */}
        <div className="card card-0">
          <div style={{ padding: '.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <Package size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 700, fontSize: '.875rem', color: 'var(--text1)' }}>Product Performance</span>
          </div>
          {prodRows.length === 0 ? <div className="empty">No data</div> : (
            <div style={{ padding: '.875rem 1rem' }}>
              {prodRows.slice(0, 10).map(p => (
                <div key={p.name} style={{ marginBottom: '.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.2rem', gap: '.5rem' }}>
                    <span style={{ fontSize: '.8rem', color: 'var(--text1)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <div style={{ display: 'flex', gap: '.75rem', flexShrink: 0, fontSize: '.75rem' }}>
                      <span style={{ color: 'var(--red)' }}>-{p.out}</span>
                      {p.ret     > 0 && <span style={{ color: 'var(--blue)' }}>↩{p.ret}</span>}
                      {p.restock > 0 && <span style={{ color: 'var(--green)' }}>+{p.restock}</span>}
                    </div>
                  </div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(p.out / maxOut) * 100}%`, background: 'var(--accent)' }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform breakdown */}
        <div className="card card-0">
          <div style={{ padding: '.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <BarChart3 size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 700, fontSize: '.875rem', color: 'var(--text1)' }}>Platform Breakdown</span>
          </div>
          {platRows.length === 0 ? <div className="empty">No platform data</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Platform</th><th>Sales</th><th>Returns</th><th>Net</th></tr></thead>
                <tbody>
                  {platRows.map(p => (
                    <tr key={p.name}>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}><span className="dot" style={{ background: p.color }} />{p.name}</div></td>
                      <td style={{ color: 'var(--red)',  fontWeight: 700 }}>{p.sale}</td>
                      <td style={{ color: 'var(--blue)', fontWeight: 600 }}>{p.ret}</td>
                      <td style={{ fontWeight: 800, color: (p.sale - p.ret) > 0 ? 'var(--text1)' : 'var(--text3)' }}>{p.sale - p.ret}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Monthly breakdown */}
      <div className="card card-0">
        <div style={{ padding: '.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <BarChart3 size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: '.875rem', color: 'var(--text1)' }}>Monthly Summary</span>
        </div>
        {months.length === 0 ? <div className="empty">No data for selected period</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th style={{ color: 'var(--green)' }}>Restocked</th>
                  <th style={{ color: 'var(--red)' }}>Platform Sales</th>
                  <th style={{ color: 'var(--blue)' }}>Returns</th>
                  <th style={{ color: 'var(--yellow)' }}>Offline</th>
                  <th style={{ color: 'var(--pink)' }}>Gifts</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {months.map(([month, d]) => {
                  const net = d.in - d.out;
                  const label = new Date(month + '-02').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                  return (
                    <tr key={month}>
                      <td style={{ fontWeight: 700, color: 'var(--text1)' }}>{label}</td>
                      <td style={{ color: 'var(--green)',  fontWeight: 600 }}>{d.restock > 0 ? `+${d.restock}` : '—'}</td>
                      <td style={{ color: 'var(--red)',    fontWeight: 600 }}>{d.sale    > 0 ? d.sale         : '—'}</td>
                      <td style={{ color: 'var(--blue)'  }}>{d.ret     > 0 ? `↩${d.ret}`  : '—'}</td>
                      <td style={{ color: 'var(--yellow)' }}>{d.offline > 0 ? d.offline    : '—'}</td>
                      <td style={{ color: 'var(--pink)'  }}>{d.gift    > 0 ? d.gift        : '—'}</td>
                      <td style={{ fontWeight: 800, color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>{net >= 0 ? '+' : ''}{net}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
