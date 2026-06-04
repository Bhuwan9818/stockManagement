'use client';
import { useEffect, useState } from 'react';
import { Package, Store, AlertTriangle, TrendingDown, TrendingUp, RefreshCw, ArrowUpRight } from 'lucide-react';

interface Dash {
  total_products: number; total_platforms: number; low_stock_count: number;
  today_out: number; month_out: number; month_in: number;
  low_stock_items: { id: number; name: string; master_stock: number; low_stock_threshold: number }[];
  recent_txns: { id: number; type: string; product_name: string; platform_name: string; platform_color: string; quantity: number; direction: number; transaction_date: string }[];
  platform_breakdown: { name: string; color: string; type: string; total_out: number; total_return: number }[];
  top_products: { name: string; master_stock: number; total_out: number }[];
}

const TYPE_LABEL: Record<string, string> = {
  sale: 'Sale', return: 'Return', restock: 'Restock',
  gift: 'Gift', offline_sale: 'Offline', adjustment: 'Adjust',
};
const TYPE_COLOR: Record<string, string> = {
  sale: 'var(--red)', return: 'var(--blue)', restock: 'var(--green)',
  gift: 'var(--pink)', offline_sale: 'var(--yellow)', adjustment: 'var(--accent2)',
};

export default function Dashboard() {
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbErr, setDbErr] = useState(false);
  const [initing, setIniting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/dashboard');
      if (r.status === 503) { setDbErr(true); setLoading(false); return; }
      if (!r.ok) { const d = await r.json(); if (d?.error === 'not_initialized') { setDbErr(true); setLoading(false); return; } throw new Error(); }
      const d = await r.json();
      if (d?.error) { setDbErr(true); setLoading(false); return; }
      setData(d); setDbErr(false);
    } catch { setDbErr(true); }
    setLoading(false);
  };

  const initDb = async () => {
    setIniting(true);
    const r = await fetch('/api/init', { method: 'POST' });
    if (r.ok) load();
    setIniting(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <RefreshCw size={28} className="spin" style={{ color: 'var(--accent)' }} />
      <div style={{ color: 'var(--text3)', fontSize: '.8rem' }}>Loading…</div>
    </div>
  );

  if (dbErr) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ maxWidth: 420, textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: 36, marginBottom: '1rem' }}>🗄️</div>
        <div className="page-title" style={{ marginBottom: '.5rem' }}>Set Up Database</div>
        <div style={{ color: 'var(--text3)', fontSize: '.8rem', marginBottom: '1rem', lineHeight: 1.6 }}>
          Click below to initialize your database. Make sure your{' '}
          <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent2)' }}>DATABASE_URL</code>{' '}
          is set in your <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent2)' }}>.env.local</code> file.
        </div>
        <div className="alert alert-warn" style={{ textAlign: 'left', fontSize: '.75rem', marginBottom: '1.25rem' }}>
          <strong>Local setup:</strong> Copy <code>.env.example</code> → <code>.env.local</code> and set your Postgres connection string.
        </div>
        <button className="btn btn-primary btn-lg" onClick={initDb} disabled={initing} style={{ width: '100%', justifyContent: 'center' }}>
          {initing ? <><RefreshCw size={14} className="spin" /> Initializing…</> : '🚀 Initialize Database'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={load} style={{ width: '100%', justifyContent: 'center', marginTop: '.5rem' }}>
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    </div>
  );

  if (!data) return null;

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="fade-up">
      <div className="page-hdr">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">{today}</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {[
          { num: data.total_products, lbl: 'Products', icon: Package, color: 'var(--accent)', bg: 'var(--accent-bg)' },
          { num: data.total_platforms, lbl: 'Channels', icon: Store, color: 'var(--blue)', bg: 'rgba(59,130,246,.12)' },
          { num: data.today_out, lbl: 'Out Today', icon: TrendingDown, color: 'var(--red)', bg: 'rgba(239,68,68,.12)' },
          { num: data.month_out, lbl: 'Out This Month', icon: TrendingDown, color: 'var(--yellow)', bg: 'rgba(245,158,11,.12)' },
          { num: data.month_in, lbl: 'Restocked Month', icon: TrendingUp, color: 'var(--green)', bg: 'rgba(34,197,94,.12)' },
          { num: data.low_stock_count, lbl: 'Low Stock', icon: AlertTriangle, color: data.low_stock_count > 0 ? 'var(--red)' : 'var(--green)', bg: data.low_stock_count > 0 ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)' },
        ].map(({ num, lbl, icon: Icon, color, bg }) => (
          <div key={lbl} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
              <div>
                <div className="stat-num" style={{ color }}>{num}</div>
                <div className="stat-lbl">{lbl}</div>
              </div>
              <div className="stat-icon" style={{ background: bg, flexShrink: 0 }}>
                <Icon size={15} style={{ color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid2" style={{ gap: '1rem', marginBottom: '1rem' }}>
        {/* Recent Activity */}
        <div className="card card-0">
          <div style={{ padding: '.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--text1)' }}>Recent Activity</span>
          </div>
          {data.recent_txns.length === 0 ? <div className="empty">No transactions yet</div> : (
            <div>
              {data.recent_txns.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.6rem 1rem', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '.8rem', color: 'var(--text1)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.product_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem', marginTop: '.15rem' }}>
                      {t.platform_name && <><span className="dot" style={{ background: t.platform_color }} /><span style={{ fontSize: '.7rem', color: 'var(--text3)' }}>{t.platform_name}</span><span style={{ color: 'var(--border2)' }}>·</span></>}
                      <span style={{ fontSize: '.7rem', color: TYPE_COLOR[t.type], fontWeight: 700 }}>{TYPE_LABEL[t.type]}</span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '.875rem', color: t.direction === 1 ? 'var(--green)' : 'var(--red)' }}>
                      {t.direction === 1 ? '+' : '-'}{t.quantity}
                    </div>
                    <div style={{ fontSize: '.65rem', color: 'var(--text3)' }}>{new Date(t.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Platform breakdown */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--text1)', marginBottom: '.875rem' }}>This Month by Channel</div>
            {data.platform_breakdown.filter(p => p.total_out > 0 || p.total_return > 0).length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: '.75rem', textAlign: 'center', padding: '1rem' }}>No activity yet</div>
            ) : data.platform_breakdown.map(p => {
              const max = Math.max(...data.platform_breakdown.map(x => Number(x.total_out)), 1);
              return (
                <div key={p.name} style={{ marginBottom: '.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.2rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.75rem', color: 'var(--text2)' }}>
                      <span className="dot" style={{ background: p.color }} />{p.name}
                      {p.total_return > 0 && <span style={{ fontSize: '.65rem', color: 'var(--blue)' }}>+{p.total_return} returned</span>}
                    </span>
                    <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text1)' }}>{p.total_out}</span>
                  </div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(Number(p.total_out)/max)*100}%`, background: p.color }} /></div>
                </div>
              );
            })}
          </div>

          {/* Low stock */}
          {data.low_stock_items.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(239,68,68,.3)', background: 'rgba(239,68,68,.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontWeight: 700, fontSize: '.85rem', color: 'var(--red)', marginBottom: '.75rem' }}>
                <AlertTriangle size={14} /> Low Stock Alert
              </div>
              {data.low_stock_items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.35rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '.8rem', color: 'var(--text2)' }}>{item.name}</span>
                  <span className="badge badge-danger">{item.master_stock} left</span>
                </div>
              ))}
            </div>
          )}

          {/* Quick links */}
          <div className="card" style={{ padding: '.875rem' }}>
            <div style={{ fontWeight: 700, fontSize: '.8rem', color: 'var(--text1)', marginBottom: '.75rem' }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {[
                { href: '/transactions?action=restock', label: '+ Add Restock', color: 'var(--green)' },
                { href: '/transactions?action=sale', label: '− Log Sale', color: 'var(--red)' },
                { href: '/transactions?action=return', label: '↩ Log Return', color: 'var(--blue)' },
                { href: '/transactions?action=offline_sale', label: '🏪 Offline Sale', color: 'var(--yellow)' },
                { href: '/transactions?action=gift', label: '🎁 Gift', color: 'var(--pink)' },
              ].map(({ href, label, color }) => (
                <a key={href} href={href} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem .6rem', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', color, fontSize: '.8rem', fontWeight: 600, textDecoration: 'none', transition: 'background .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {label} <ArrowUpRight size={12} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
