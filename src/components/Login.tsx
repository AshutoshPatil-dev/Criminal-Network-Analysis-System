import { useState } from 'react';
import { useApp } from '../store';

const RANK_ORDER = ['Inspector', 'Dy. Supdt. of Police', 'Sub-Inspector', 'Constable', 'Officer'];

export default function Login() {
  const { t, lang, signIn, signUp, signInDemo, officers } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rank, setRank] = useState('Sub-Inspector');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('Bihar');
  const [badge, setBadge] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (mode === 'signin') {
      const err = await signIn(email, password);
      if (err) setError(err);
    } else {
      if (!name.trim()) { setError('Name is required.'); setBusy(false); return; }
      if (!district.trim()) { setError('District is required.'); setBusy(false); return; }
      const err = await signUp({
        name: name.trim(),
        badgeNumber: badge.trim() || 'BR/TMP/0000',
        rank,
        district: district.trim(),
        state: state.trim(),
        email: email.trim(),
        phone: phone.trim() || '—',
        role: 'case-officer',
      }, password);
      if (err) setError(err);
    }
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
              Restricted law-enforcement intelligence workspace. All activity is recorded in an immutable audit trail.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-blue-100">
              <li>· Case graph &amp; link analysis</li>
              <li>· FIR / report builder with OCR intake</li>
              <li>· Officer &amp; evidence management</li>
            </ul>
          </div>
          <p className="text-xs text-blue-300 mt-8">{lang === 'hi' ? 'अधिकृत कर्मियों के लिए' : 'Authorized personnel only'}</p>
        </div>

        <div className="bg-white p-10">
          {mode === 'signin' ? (
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
                Supabase Auth when linked to a live project; otherwise any password works for a seeded officer email (offline demo).
              </p>
              <button type="button" onClick={() => { setMode('signup'); setError(null); }} className="text-sm text-nexus-blue hover:underline">
                {t('signUpNewOfficer')}
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <h1 className="text-xl font-bold text-nexus-text">{t('signUpNewOfficer')}</h1>
              <div>
                <label htmlFor="su-name" className="block text-sm font-medium text-nexus-text mb-1">{t('officerName')} <span className="text-nexus-risk-high">*</span></label>
                <input id="su-name" type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue" placeholder="Inspector Anil Singh" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('rank')}</label>
                  <select value={rank} onChange={e => setRank(e.target.value)} className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm bg-white">
                    {RANK_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('badgeNumber')}</label>
                  <input type="text" value={badge} onChange={e => setBadge(e.target.value)} placeholder="BR/INSP/1124" className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('district')} <span className="text-nexus-risk-high">*</span></label>
                  <input type="text" required value={district} onChange={e => setDistrict(e.target.value)} placeholder="Patna" className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('stateLabel')}</label>
                  <input type="text" value={state} onChange={e => setState(e.target.value)} className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-nexus-text mb-1">{t('emailAddress')} <span className="text-nexus-risk-high">*</span></label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('phoneLabel')}</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91-…" className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('password')} <span className="text-nexus-risk-high">*</span></label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm" />
                </div>
              </div>
              {error && <p className="text-sm text-nexus-risk-high" role="alert">{error}</p>}
              <button type="submit" disabled={busy} className="w-full px-4 py-2.5 rounded-lg bg-nexus-blue text-white font-semibold hover:bg-nexus-blue-light disabled:opacity-50 transition">
                {busy ? '…' : t('createAccount')}
              </button>
              <button type="button" onClick={() => { setMode('signin'); setError(null); }} className="text-sm text-nexus-blue hover:underline">
                {t('backToSignIn')}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-nexus-border">
            <p className="text-xs font-semibold text-nexus-text-secondary uppercase tracking-wide mb-2">{t('quickDemoAccess')}</p>
            <div className="grid grid-cols-1 gap-2">
              {officers.slice(0, 4).map(o => (
                <button
                  key={o.id}
                  onClick={() => signInDemo(o.id)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-nexus-border text-sm hover:bg-nexus-surface transition"
                >
                  <span className="font-medium text-nexus-text">{o.name}</span>
                  <span className="text-xs text-nexus-text-secondary">{o.rank} · {o.district}, {o.state}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}