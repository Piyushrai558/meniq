import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import Sidebar from '../components/Sidebar';
import { ToastContext } from '../App';

const PLAN_COLORS = { free: '#8A7B6E', basic: '#2D6A4F', pro: '#7C3AED' };
const PLAN_LABELS = { free: 'Free', basic: 'Basic', pro: 'Pro' };

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName]       = useState(user?.name || '');
  const [rName, setRName]     = useState(user?.restaurant_name || '');
  const [saving, setSaving]   = useState(false);

  const [oldPwd, setOldPwd]   = useState('');
  const [newPwd, setNewPwd]   = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  const plan = user?.plan || 'free';

  const saveProfile = async () => {
    if (!name.trim()) { ToastContext.show('Name cannot be empty'); return; }
    setSaving(true);
    try {
      const data = await api('PUT', '/auth/profile', { name, restaurant_name: rName });
      updateUser(data.user);
      ToastContext.show('Profile updated!');
    } catch (err) {
      ToastContext.show(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!oldPwd || !newPwd) { ToastContext.show('Both fields are required'); return; }
    if (newPwd.length < 6)   { ToastContext.show('New password must be at least 6 characters'); return; }
    setPwdSaving(true);
    try {
      await api('PUT', '/auth/change-password', { old_password: oldPwd, new_password: newPwd });
      ToastContext.show('Password changed!');
      setOldPwd('');
      setNewPwd('');
    } catch (err) {
      ToastContext.show(err.message);
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>Settings</h2>
            <p>Manage your profile, password, and plan.</p>
          </div>
        </div>

        <div className="settings-wrap">

          {/* Plan info */}
          <div className="settings-card">
            <h3 className="settings-card-title">Current Plan</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="plan-badge" style={{ background: PLAN_COLORS[plan] }}>
                {PLAN_LABELS[plan]}
              </span>
              {plan !== 'pro' && (
                <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>
                  Upgrade from Dashboard to unlock more menus and features.
                </span>
              )}
              {plan === 'pro' && (
                <span style={{ fontSize: 13, color: 'var(--green)' }}>
                  You're on the Pro plan — enjoy unlimited access!
                </span>
              )}
            </div>
            {user?.plan_expires_at && (
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 8 }}>
                Renews on {new Date(user.plan_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Profile */}
          <div className="settings-card">
            <h3 className="settings-card-title">Profile</h3>
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Restaurant name</label>
              <input
                className="form-input"
                value={rName}
                onChange={e => setRName(e.target.value)}
                placeholder="Your restaurant / business name"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                value={user?.email || ''}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
              <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4, display: 'block' }}>
                Email cannot be changed.
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={saveProfile} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>

          {/* Change password */}
          <div className="settings-card">
            <h3 className="settings-card-title">Change Password</h3>
            <div className="form-group">
              <label className="form-label">Current password</label>
              <input
                className="form-input"
                type="password"
                value={oldPwd}
                onChange={e => setOldPwd(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">New password</label>
              <input
                className="form-input"
                type="password"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={changePassword} disabled={pwdSaving}>
                {pwdSaving ? 'Updating…' : 'Change password'}
              </button>
            </div>
          </div>

          {/* Logout */}
          <div className="settings-card" style={{ borderColor: 'rgba(200,98,42,0.25)' }}>
            <h3 className="settings-card-title">Account</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 16 }}>
              Signed in as <strong>{user?.email}</strong>
            </p>
            <button
              className="btn-ghost"
              style={{ color: '#9B1C1C', borderColor: 'rgba(155,28,28,0.3)' }}
              onClick={() => { logout(); navigate('/'); }}
            >
              Sign out
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
