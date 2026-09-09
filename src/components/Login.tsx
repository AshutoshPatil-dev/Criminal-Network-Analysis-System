import { useState } from 'react';
import { useApp } from '../store';

export default function Login() {
  const { t, signIn } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const err = await signIn(email, password);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-nexus-surface flex items-center justify-center p-6" role="dialog" aria-label="Sign in">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl border border-nexus-border">
        <div className="bg-nexus-blue text-white p-10 flex flex-col justify-between">
          <div>
            <div className="text-4xl font-black tracking-tight">NEXUS<span className="text-nexus-accent">.</span></div>
            <p className="text-blue-200 text-sm mt-1">{t('tagline')}</p>
            <p className="mt-8 text-blue-100 leading-relaxed text-sm">
              {t('loginTagline')}
            </p>
            <ul className="mt-6 space-y-2 text-sm text-blue-100">
              <li>· {t('loginF1')}</li>
              <li>· {t('loginF2')}</li>
              <li>· {t('loginF3')}</li>
            </ul>
          </div>
          <p className="text-xs text-blue-300 mt-8">{t('loginAuthorized')}</p>
        </div>

        <div className="bg-white p-10">
          <form onSubmit={submit} className="space-y-4">
            <h1 className="text-xl font-bold text-nexus-text">{t('signIn')}</h1>
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-nexus-text mb-1">{t('emailAddress')}</label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="r.sharma@biharpolice.in"
                className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue"
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-nexus-text mb-1">{t('password')}</label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-nexus-risk-high" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full px-4 py-2.5 rounded-lg bg-nexus-blue text-white font-semibold hover:bg-nexus-blue-light disabled:opacity-50 transition"
            >
              {busy ? '…' : t('signIn')}
            </button>
            <p className="text-xs text-nexus-text-secondary leading-relaxed">
              {t('loginPrompt')}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}