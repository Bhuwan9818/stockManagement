'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Store, ClipboardList, BarChart3, Zap, X, Users, LogOut, Shield, User, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ClipboardList },
  { href: '/products', label: 'Products & Stock', icon: Package },
  { href: '/platforms', label: 'Channels', icon: Store },
  { href: '/reports', label: 'Reports & Export', icon: BarChart3 },
];

interface UserInfo { name: string; email: string; role: 'admin' | 'manager'; }
interface Props { open: boolean; onClose: () => void; }

export default function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUser(d.user));
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <nav className={`sidebar ${open ? 'open' : ''}`}>

        {/* Logo */}
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
            <div style={{ width: 30, height: 30, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={15} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '.9rem', color: 'var(--text1)', letterSpacing: '-.02em' }}>StockFlow</div>
              <div style={{ fontSize: '.6rem', color: 'var(--text3)' }}>Inventory Manager</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '.25rem' }}><X size={15} /></button>
        </div>

        {/* Nav */}
        <div className="sidebar-nav">
          <div className="nav-section">Menu</div>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={`nav-link ${active ? 'active' : ''}`} onClick={onClose}>
                <Icon size={15} strokeWidth={active ? 2.5 : 2} />{label}
              </Link>
            );
          })}

          {/* Admin-only: Users */}
          {user?.role === 'admin' && (
            <>
              <div className="nav-section" style={{ marginTop: '.75rem' }}>Admin</div>
              <Link href="/users" className={`nav-link ${pathname.startsWith('/users') ? 'active' : ''}`} onClick={onClose}>
                <Users size={15} /> User Management
              </Link>
            </>
          )}
        </div>

        {/* User panel at bottom */}
        {user && (
          <div style={{ padding: '.875rem 1rem', borderTop: '1px solid var(--border)' }}>
            <div
              onClick={() => setShowUserMenu(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer', padding: '.5rem .625rem', borderRadius: 'var(--r-sm)', transition: 'background .15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: user.role === 'admin' ? 'var(--accent-bg)' : 'rgba(34,197,94,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {user.role === 'admin' ? <Shield size={13} style={{ color: 'var(--accent2)' }} /> : <User size={13} style={{ color: 'var(--green)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: '.65rem', color: 'var(--text3)', textTransform: 'capitalize' }}>{user.role}</div>
              </div>
              <ChevronDown size={13} style={{ color: 'var(--text3)', transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
            </div>

            {showUserMenu && (
              <div style={{ marginTop: '.375rem', padding: '.375rem', background: 'var(--bg3)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '.7rem', color: 'var(--text3)', padding: '.25rem .5rem .375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </div>
                <button
                  onClick={handleLogout} disabled={loggingOut}
                  className="nav-link"
                  style={{ color: 'var(--red)', width: '100%', marginBottom: 0 }}>
                  <LogOut size={13} />
                  {loggingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </>
  );
}
