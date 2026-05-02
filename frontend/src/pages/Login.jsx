import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { formatApiError } from '../lib/api';
import { ArrowRight, Wallet } from '@phosphor-icons/react';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try { await login(email, password); nav('/'); }
    catch (e) { setErr(formatApiError(e.response?.data?.detail) || 'Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-paper grid lg:grid-cols-2" data-testid="login-page">
      <div className="flex flex-col justify-center px-8 sm:px-16 py-12 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-md bg-terracotta flex items-center justify-center">
            <Wallet size={22} weight="bold" color="white" />
          </div>
          <span className="font-display text-2xl font-extrabold tracking-tight">MyFinance</span>
        </div>

        <h1 className="font-display text-5xl font-black tracking-tighter leading-none mb-3">Welcome<br/>back.</h1>
        <p className="text-muted mb-10">Sign in to keep your money story moving.</p>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted mb-2 block">Email</label>
            <input data-testid="login-email-input" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)}
              className="w-full bg-transparent border border-line rounded-md px-4 py-3 focus:border-terracotta focus:ring-1 focus:ring-terracotta outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted mb-2 block">Password</label>
            <input data-testid="login-password-input" type="password" required value={password} onChange={(e)=>setPassword(e.target.value)}
              className="w-full bg-transparent border border-line rounded-md px-4 py-3 focus:border-terracotta focus:ring-1 focus:ring-terracotta outline-none" />
          </div>
          {err && <div data-testid="login-error" className="text-sm text-clay bg-clay/5 border border-clay/20 rounded-md px-4 py-3">{err}</div>}
          <button data-testid="login-submit-button" type="submit" disabled={loading}
            className="w-full bg-ink text-white rounded-md px-6 py-4 font-semibold hover:bg-terracotta transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? 'Signing in…' : <>Sign in <ArrowRight size={18} weight="bold" /></>}
          </button>
        </form>

        <p className="text-sm text-muted mt-8">
          New here? <Link data-testid="goto-register-link" to="/register" className="text-terracotta font-semibold hover:underline">Create an account</Link>
        </p>
      </div>

      <div className="hidden lg:block relative overflow-hidden bg-surface-alt">
        <div className="absolute inset-0" style={{
          backgroundImage:'url(https://images.unsplash.com/photo-1603484477859-abe6a73f9366?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400)',
          backgroundSize:'cover', backgroundPosition:'center', filter:'saturate(0.85)'
        }} />
        <div className="absolute inset-0 bg-gradient-to-br from-bone/30 via-transparent to-terracotta/20" />
        <div className="absolute bottom-12 left-12 right-12">
          <p className="font-display text-3xl font-bold tracking-tight text-ink leading-tight">
            Quiet money, <br/><span className="text-terracotta">loud progress.</span>
          </p>
          <p className="text-muted mt-3 text-sm max-w-sm">A calm dashboard for tracking expenses, paying down debt, and watching your buckets fill.</p>
        </div>
      </div>
    </div>
  );
}
