'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Eye, EyeOff, RefreshCw, Lock, Mail, AlertTriangle, CheckCircle } from 'lucide-react';

type DbState = 'checking' | 'ready' | 'not_initialized' | 'no_database';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authChecking, setAuthChecking] = useState(true);
  const [dbState, setDbState] = useState<DbState>('checking');
  const [initing, setIniting] = useState(false);
  const [initMsg, setInitMsg] = useState('');

  // Check if already logged in
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => { if (r.ok) router.replace('/'); })
      .finally(() => setAuthChecking(false));
  }, [router]);

  // Check DB status
  useEffect(() => {
    checkDb();
  }, []);

  const checkDb = async () => {
    setDbState('checking');
    try {
      const r = await fetch('/api/init');
      if (!r.ok) { setDbState('no_database'); return; }
      const d = await r.json();
      setDbState(d.initialized ? 'ready' : 'not_initialized');
    } catch {
      setDbState('no_database');
    }
  };

  const handleInit = async () => {
    setIniting(true); setInitMsg('');
    try {
      const r = await fetch('/api/init', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) {
        setInitMsg('Error: ' + (d.error || 'Initialization failed'));
        setIniting(false); return;
      }
      setInitMsg('✅ Database ready!');
      if (d.credentials) {
        setForm({ email: d.credentials.email, password: d.credentials.password });
      }
      setDbState('ready');
    } catch {
      setInitMsg('Network error — check your DATABASE_URL');
    }
    setIniting(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.email || !form.password) { setError('Please enter email and password'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Login failed'); setLoading(false); return; }
      // Hard redirect so the browser sends the new cookie to middleware
      window.location.href = '/';
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  if (authChecking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <RefreshCw size={24} className="spin" style={{ color: 'var(--accent)' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.1) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.07) 0%, transparent 70%)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 52, height: 52, background: 'var(--accent)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 0 40px rgba(108,99,255,0.35)' }}>
            <Zap size={26} color="white" strokeWidth={2.5} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text1)', letterSpacing: '-.02em' }}>StockFlow</div>
          <div style={{ fontSize: '.8rem', color: 'var(--text3)', marginTop: '.25rem' }}>Inventory Management System</div>
        </div>

        {/* DB Status Banner */}
        {dbState === 'checking' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.75rem 1rem', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: '1rem', fontSize: '.8rem', color: 'var(--text3)' }}>
            <RefreshCw size={13} className="spin" /> Checking database connection…
          </div>
        )}

        {dbState === 'no_database' && (
          <div style={{ padding: '.875rem 1rem', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', color: 'var(--red)', fontWeight: 700, fontSize: '.82rem', marginBottom: '.35rem' }}>
              <AlertTriangle size={14} /> Cannot connect to database
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--text3)', lineHeight: 1.6 }}>
              Make sure <code style={{ background: 'var(--bg3)', padding: '1px 5px', borderRadius: 4, color: 'var(--accent2)' }}>DATABASE_URL</code> is set correctly in your environment variables.
            </div>
            <button className="btn btn-secondary btn-sm" onClick={checkDb} style={{ marginTop: '.75rem' }}>
              <RefreshCw size={12} /> Retry connection
            </button>
          </div>
        )}

        {dbState === 'not_initialized' && (
          <div style={{ padding: '.875rem 1rem', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 10, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', color: 'var(--yellow)', fontWeight: 700, fontSize: '.82rem', marginBottom: '.35rem' }}>
              <AlertTriangle size={14} /> Database not initialized
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginBottom: '.75rem', lineHeight: 1.6 }}>
              Database is connected but tables don&apos;t exist yet. Click below to set up. A default admin account will be created automatically.
            </div>
            {initMsg && (
              <div style={{ fontSize: '.75rem', color: initMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)', marginBottom: '.5rem', fontWeight: 600 }}>
                {initMsg}
              </div>
            )}
            <button className="btn btn-primary" onClick={handleInit} disabled={initing} style={{ width: '100%', justifyContent: 'center', fontSize: '.82rem' }}>
              {initing ? <><RefreshCw size={13} className="spin" /> Initializing database…</> : '🚀 Initialize Database & Create Admin'}
            </button>
          </div>
        )}

        {dbState === 'ready' && initMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.65rem 1rem', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 10, marginBottom: '1rem', fontSize: '.8rem', color: 'var(--green)' }}>
            <CheckCircle size={14} /> {initMsg}
          </div>
        )}

        {/* Login form */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '2rem', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text1)', marginBottom: '.25rem' }}>Sign in</div>
          <div style={{ fontSize: '.78rem', color: 'var(--text3)', marginBottom: '1.5rem' }}>Enter your credentials to continue</div>

          {error && (
            <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '1rem' }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                <input
                  type="email" className="input" required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@stockflow.com"
                  style={{ paddingLeft: '2.25rem' }}
                  autoComplete="email"
                  disabled={dbState === 'no_database'}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                <input
                  type={showPass ? 'text' : 'password'} className="input" required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  style={{ paddingLeft: '2.25rem', paddingRight: '2.5rem' }}
                  autoComplete="current-password"
                  disabled={dbState === 'no_database'}
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  style={{ position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0, display: 'flex' }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg"
              disabled={loading || dbState === 'no_database' || dbState === 'checking'}
              style={{ width: '100%', justifyContent: 'center', marginTop: '.25rem' }}>
              {loading ? <><RefreshCw size={14} className="spin" /> Signing in…</> : 'Sign In'}
            </button>
          </form>
        </div>
        
      </div>
    </div>
  );
}
