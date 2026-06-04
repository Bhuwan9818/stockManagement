'use client';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { Menu, Zap, LogOut } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  if (!mounted) {
    return (
      <div className="layout">
        <nav className="sidebar" />
        <main className="main">{children}</main>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile topbar */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <div style={{ width: 26, height: 26, background: 'var(--accent)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={13} color="white" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '.875rem', color: 'var(--text1)' }}>StockFlow</span>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ color: 'var(--red)' }}>
            <LogOut size={14} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setSidebarOpen(true)}>
            <Menu size={15} /> Menu
          </button>
        </div>
      </div>

      <main className="main fade-up">{children}</main>
    </div>
  );
}
