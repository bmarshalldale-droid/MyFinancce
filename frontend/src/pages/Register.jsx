import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { formatApiError } from '../lib/api';
import { ArrowRight, Wallet } from '@phosphor-icons/react';

export default function Register() {
  const { user, register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try { await register(email, password, name); nav('/'); }
    catch (e) { setErr(formatApiError(e.response?.data?.detail) || 'Registration failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-paper grid lg:grid-cols-2" data-testid="register-page">
      <div className="flex flex-col justify-center px-8 sm:px-16 py-12 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-md bg-terracotta flex items-center justify-center">
            <Wallet size={22} weight="bold" color="white" />
          </div>
          <span className="font-display text-2xl font-extrabold tracking-tight">MyFinance</span>
        </div>

        <h1 className="font-display text-5xl font-black tracking-tighter leading-none mb-3">Take the<br/>first step.</h1>
        <p className="text-muted mb-10">Create your account and start clearing the noise.</p>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted mb-2 block">Name</label>
            <input data-testid="register-name-input" type="text" value={name} onChange={(e)=>setName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full bg-transparent border border-line rounded-md px-4 py-3 focus:border-terracotta focus:ring-1 focus:ring-terracotta outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted mb-2 block">Email</label>
            <input data-testid="register-email-input" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)}
              className="w-full bg-transparent border border-line rounded-md px-4 py-3 focus:border-terracotta focus:ring-1 focus:ring-terracotta outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-muted mb-2 block">Password</label>
            <input data-testid="register-password-input" type="password" required minLength={6} value={password} onChange={(e)=>setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full bg-transparent border border-line rounded-md px-4 py-3 focus:border-terracotta focus:ring-1 focus:ring-terracotta outline-none" />
          </div>
          {err && <div data-testid="register-error" className="text-sm text-clay bg-clay/5 border border-clay/20 rounded-md px-4 py-3">{err}</div>}
          <button data-testid="register-submit-button" type="submit" disabled={loading}
            className="w-full bg-ink text-white rounded-md px-6 py-4 font-semibold hover:bg-terracotta transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? 'Creating account…' : <>Create account <ArrowRight size={18} weight="bold" /></>}
          </button>
        </form>

        <p className="text-sm text-muted mt-8">
          Already have an account? <Link data-testid="goto-login-link" to="/login" className="text-terracotta font-semibold hover:underline">Sign in</Link>
        </p>
      </div>

      <div className="hidden lg:block relative overflow-hidden bg-surface-alt">
        <div className="absolute inset-0" style={{
          backgroundImage:'url(https://images.unsplash.com/photo-1603484477859-abe6a73f9366?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400)',
          backgroundSize:'cover', backgroundPosition:'center', filter:'saturate(0.85)'
        }} />
        <div className="absolute inset-0 bg-gradient-to-tr from-moss/20 via-transparent to-ochre/30" />
        <div className="absolute bottom-12 left-12 right-12">
          <p className="font-display text-3xl font-bold tracking-tight text-ink leading-tight">
            Less anxiety, <br/><span className="text-moss">more clarity.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
