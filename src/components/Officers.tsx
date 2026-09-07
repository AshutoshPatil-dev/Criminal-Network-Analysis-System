import { useEffect, useState } from 'react';
import { useApp } from '../store';

const RANK_ORDER = ['Inspector', 'Dy. Supdt. of Police', 'Sub-Inspector', 'Inspector General', 'Constable', 'Officer'];
const ROLE_ORDER = ['case-officer', 'analyst', 'admin'];

const ROLE_STYLE: Record<string, string> = {
  'case-officer': 'bg-blue-100 text-blue-800',
  analyst: 'bg-violet-100 text-violet-800',
  admin: 'bg-red-100 text-red-800',
};

const initialsOf = (name: string) =>
  name.replace(/^(Inspector|Sub-Inspector|Constable|Dy\.?|DSP)\s+/i, '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export default function Officers() {
  const { t, officers, addOfficer, updateOfficer, removeOfficer, refreshOfficers, user } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [form, setForm] = useState({
    name: '', badgeNumber: '', rank: 'Sub-Inspector', district: '', state: 'Bihar',
    email: '', phone: '', role: 'case-officer' as 'case-officer' | 'analyst' | 'admin',
  });
  const [notice, setNotice] = useState<string | null>(null);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) void refreshOfficers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const startNew = () => {
    setEditingId(null);
    setPassword('');
    setForm({ name: '', badgeNumber: '', rank: 'Sub-Inspector', district: '', state: 'Bihar', email: '', phone: '', role: 'case-officer' });
    setNotice(null);
  };

  const startEdit = (id: string) => {
    const o = officers.find(x => x.id === id);
    if (!o) return;
    setEditingId(id);
    setPassword('');
    setForm({ name: o.name, badgeNumber: o.badgeNumber, rank: o.rank, district: o.district, state: o.state, email: o.email, phone: o.phone, role: o.role });
    setNotice(null);
  };

  const save = async () => {
    if (!isAdmin) { setNotice(t('adminOnly')); return; }
    if (!form.name.trim() || !form.district.trim()) { setNotice(t('includeMandatory')); return; }
    if (!editingId && password.length < 6) { setNotice(t('officerPasswordShort')); return; }
    let msg: string;
    if (editingId) {
      updateOfficer(editingId, form);
      msg = 'Officer profile updated.';
    } else {
      const err = await addOfficer(form, password);
      if (err) { setNotice(err); return; }
      msg = 'Officer added.';
    }
    startNew();
    setNotice(msg);
  };

  const districtGroups = officers.reduce<Record<string, typeof officers>>((acc, o) => {
    const key = o.district || '—';
    (acc[key] ||= []).push(o);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text">{t('officersTitle')}</h1>
          <p className="text-sm text-nexus-text-secondary mt-1">{t('officersSubtitle')}</p>
        </div>
        {isAdmin && (
          <button onClick={startNew} className="px-4 py-2 rounded-lg bg-nexus-blue text-white text-sm font-semibold hover:bg-nexus-blue-light transition">
            + {t('addOfficer')}
          </button>
        )}
      </div>

      {notice && <div className="bg-green-50 border border-green-300 rounded-xl px-4 py-3 text-sm text-green-800" role="status">{notice}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {Object.entries(districtGroups).map(([district, list]) => (
            <div key={district} className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wide text-nexus-text-secondary mb-3">
                {district} · {list.length} officer{list.length === 1 ? '' : 's'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {list.map(o => (
                  <div key={o.id} className="bg-white rounded-xl shadow-sm border border-nexus-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-nexus-blue text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {initialsOf(o.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-nexus-text leading-tight">
                            {o.name}{o.id === user?.id && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-nexus-accent text-nexus-blue font-bold">YOU</span>}
                          </p>
                          <p className="text-xs text-nexus-text-secondary">{o.rank} · {o.badgeNumber}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ROLE_STYLE[o.role]}`}>{o.role}</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                      <dt className="text-nexus-text-secondary">{t('district')}</dt><dd className="font-medium">{o.district}, {o.state}</dd>
                      <dt className="text-nexus-text-secondary">{t('emailAddress')}</dt><dd className="font-medium truncate">{o.email}</dd>
                      <dt className="text-nexus-text-secondary">{t('phoneLabel')}</dt><dd className="font-mono">{o.phone}</dd>
                    </dl>
                    <div className="mt-3 flex gap-2">
                      {isAdmin && (
                        <>
                          <button onClick={() => startEdit(o.id)} className="text-xs px-2.5 py-1 rounded-md border border-nexus-border text-nexus-text hover:bg-nexus-surface transition">
                            {t('edit')}
                          </button>
                          {o.id !== user?.id && (
                            <button onClick={() => removeOfficer(o.id)} className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-nexus-risk-high hover:bg-red-50 transition">
                              {t('delete')}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {officers.length === 0 && <p className="text-sm text-nexus-text-secondary">{t('noOfficers')}</p>}
        </div>

        {isAdmin ? (
          <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-5 h-fit">
            <h2 className="font-semibold text-lg mb-1">{editingId ? t('editOfficer') : t('addOfficer')}</h2>
            <p className="text-sm text-nexus-text-secondary mb-4">{t('officerFormHint')}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-nexus-text mb-1">{t('officerName')} <span className="text-nexus-risk-high">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Inspector Anil Singh" className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('rank')}</label>
                  <select value={form.rank} onChange={e => setForm({ ...form, rank: e.target.value })} className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm bg-white">
                    {RANK_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('badgeNumber')}</label>
                  <input type="text" value={form.badgeNumber} onChange={e => setForm({ ...form, badgeNumber: e.target.value })} placeholder="BR/INSP/1124" className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('district')} <span className="text-nexus-risk-high">*</span></label>
                  <input type="text" value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} placeholder="Patna" className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('stateLabel')}</label>
                  <input type="text" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('emailAddress')} <span className="text-nexus-risk-high">*</span></label>
                  <input type="email" value={form.email} disabled={!!editingId} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="officer@biharpolice.in" className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm disabled:bg-nexus-surface disabled:text-nexus-text-secondary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('phoneLabel')}</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91-…" className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm" />
                </div>
                {!editingId ? (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-nexus-text mb-1">{t('officerPassword')} <span className="text-nexus-risk-high">*</span></label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm" />
                    <p className="text-xs text-nexus-text-secondary mt-1">{t('officerPasswordHint')}</p>
                  </div>
                ) : (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-nexus-text mb-1">{t('officerPassword')}</label>
                    <p className="text-xs text-nexus-text-secondary">{t('officerPasswordUnchangeable')}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-nexus-text mb-1">{t('roleLabel')}</label>
                  <div className="flex gap-2">
                    {ROLE_ORDER.map(r => (
                      <button key={r} type="button" onClick={() => setForm({ ...form, role: r as typeof form.role })} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${form.role === r ? 'bg-nexus-blue text-white border-nexus-blue' : 'border-nexus-border text-nexus-text-secondary hover:bg-nexus-surface'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {notice && <p className="text-sm text-nexus-risk-high" role="alert">{notice}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={save} className="flex-1 px-4 py-2.5 rounded-lg bg-nexus-blue text-white text-sm font-semibold hover:bg-nexus-blue-light transition">
                  {editingId ? t('saveChanges') : t('addOfficer')}
                </button>
                <button onClick={startNew} className="px-4 py-2.5 rounded-lg border border-nexus-border text-sm hover:bg-nexus-surface transition">{t('clear')}</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-nexus-surface rounded-xl border border-nexus-border p-5 h-fit">
            <h2 className="font-semibold text-lg mb-1">{t('officersTitle')}</h2>
            <p className="text-sm text-nexus-text-secondary">{t('adminOnly')}</p>
          </div>
        )}
      </div>
    </div>
  );
}