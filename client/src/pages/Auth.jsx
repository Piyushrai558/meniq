import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { ToastContext } from '../App';

export default function Auth() {
  const [searchParams]  = useSearchParams();
  const mode            = searchParams.get('mode') || 'login';
  const token           = searchParams.get('token') || '';

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPwd, setConfirmPwd]     = useState('');
  const [name, setName]                 = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError]               = useState('');
  const [info, setInfo]                 = useState('');
  const [submitting, setSubmitting]     = useState(false);

  const { login, signup, user } = useAuth();
  const navigate = useNavigate();

  // Redirect already-logged-in users
  useEffect(() => { if (user) navigate('/dashboard'); }, [user]);

  // Auto-verify email when mode=verify
  useEffect(() => {
    if (mode === 'verify' && token) verifyEmail();
  }, [mode, token]);

  const verifyEmail = async () => {
    setSubmitting(true);
    try {
      const data = await api('GET', `/auth/verify-email?token=${token}`);
      setInfo(data.message || 'Email verified! You can now log in.');
    } catch (err) {
      setError(err.message || 'Invalid or expired verification link.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        ToastContext.show('Welcome back!');
        navigate('/dashboard');

      } else if (mode === 'signup') {
        if (!name.trim()) throw new Error('Please enter your name');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        await signup(email, password, name, restaurantName);
        ToastContext.show('Account created! Check your email to verify.');
        navigate('/dashboard');

      } else if (mode === 'forgot') {
        if (!email.trim()) throw new Error('Please enter your email');
        await api('POST', '/auth/forgot-password', { email });
        setInfo('If that email exists, a reset link has been sent. Check your inbox.');

      } else if (mode === 'reset') {
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        if (password !== confirmPwd) throw new Error('Passwords do not match');
        await api('POST', '/auth/reset-password', { token, password });
        setInfo('Password updated! You can now log in.');
        setTimeout(() => navigate('/auth?mode=login'), 2000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const kd = (e) => { if (e.key === 'Enter') handleSubmit(); };

  // ── Verify screen ──────────────────────────────────────────────────────────
  if (mode === 'verify') {
    return (
      <div className="auth-page">
        <LeftPanel />
        <div className="auth-right">
          <div className="auth-form-wrap">
            <h3>{submitting ? 'Verifying…' : error ? 'Verification failed' : 'Email verified!'}</h3>
            {submitting && <div className="loading" style={{ padding: '20px 0' }}><div className="spinner" /></div>}
            {info  && <div className="auth-success">{info}</div>}
            {error && <div className="auth-error">{error}</div>}
            {!submitting && (
              <button className="btn-auth" style={{ marginTop: 16 }} onClick={() => navigate('/auth?mode=login')}>
                Go to login
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password screen ─────────────────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className="auth-page">
        <LeftPanel />
        <div className="auth-right">
          <div className="auth-form-wrap">
            <h3>Forgot password?</h3>
            <p>Enter your email and we'll send a reset link.</p>
            {error && <div className="auth-error">{error}</div>}
            {info  && <div className="auth-success">{info}</div>}
            {!info && (
              <>
                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input type="email" className="form-input" placeholder="you@restaurant.com"
                    value={email} onChange={e => setEmail(e.target.value)} onKeyDown={kd} />
                </div>
                <button className="btn-auth" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send reset link'}
                </button>
              </>
            )}
            <div className="auth-switch">
              <a onClick={() => navigate('/auth?mode=login')}>← Back to login</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Reset password screen ──────────────────────────────────────────────────
  if (mode === 'reset') {
    const hasToken = token && token.length > 10;
    return (
      <div className="auth-page">
        <LeftPanel />
        <div className="auth-right">
          <div className="auth-form-wrap">
            <h3>Set new password</h3>
            {!hasToken ? (
              <>
                <div className="auth-error">
                  This reset link is invalid or has already been used. Please request a new one.
                </div>
                <button className="btn-auth" style={{ marginTop: 16 }}
                  onClick={() => navigate('/auth?mode=forgot')}>
                  Request new reset link
                </button>
              </>
            ) : (
              <>
                <p>Choose a new password for your account.</p>
                {error && <div className="auth-error">{error}</div>}
                {info  && <div className="auth-success">{info}</div>}
                {!info && (
                  <>
                    <div className="form-group">
                      <label className="form-label">New password</label>
                      <input type="password" className="form-input" placeholder="At least 6 characters"
                        value={password} onChange={e => setPassword(e.target.value)} onKeyDown={kd} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm password</label>
                      <input type="password" className="form-input" placeholder="Repeat password"
                        value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} onKeyDown={kd} />
                    </div>
                    <button className="btn-auth" onClick={handleSubmit} disabled={submitting}>
                      {submitting ? 'Saving…' : 'Update password'}
                    </button>
                  </>
                )}
              </>
            )}
            <div className="auth-switch">
              <a onClick={() => navigate('/auth?mode=login')}>← Back to login</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Login / Signup ─────────────────────────────────────────────────────────
  const isLogin = mode === 'login';
  return (
    <div className="auth-page">
      <LeftPanel />
      <div className="auth-right">
        <div className="auth-form-wrap">
          <h3>{isLogin ? 'Welcome back' : 'Create your account'}</h3>
          <p>{isLogin ? 'Sign in to your account.' : 'Start for free — no credit card needed.'}</p>

          {error && <div className="auth-error">{error}</div>}

          {!isLogin && (
            <>
              <div className="form-group">
                <label className="form-label">Restaurant name</label>
                <input className="form-input" placeholder="e.g. Spice Garden"
                  value={restaurantName} onChange={e => setRestaurantName(e.target.value)} onKeyDown={kd} />
              </div>
              <div className="form-group">
                <label className="form-label">Your name</label>
                <input className="form-input" placeholder="Rajesh Sharma"
                  value={name} onChange={e => setName(e.target.value)} onKeyDown={kd} />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input type="email" className="form-input" placeholder="you@restaurant.com"
              value={email} onChange={e => setEmail(e.target.value)} onKeyDown={kd} />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
              {isLogin && (
                <a style={{ fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}
                   onClick={() => navigate('/auth?mode=forgot')}>
                  Forgot password?
                </a>
              )}
            </div>
            <input type="password" className="form-input"
              placeholder={isLogin ? 'Your password' : 'At least 6 characters'}
              value={password} onChange={e => setPassword(e.target.value)} onKeyDown={kd} />
          </div>

          <button className="btn-auth" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Please wait…' : isLogin ? 'Sign in' : 'Create free account'}
          </button>

          <div className="auth-switch">
            {isLogin
              ? <>No account? <a onClick={() => navigate('/auth?mode=signup')}>Sign up free</a></>
              : <>Already have an account? <a onClick={() => navigate('/auth?mode=login')}>Sign in</a></>
            }
          </div>
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => navigate('/')}>← Back to home</button>
          </div>
          <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: 'var(--ink-faint)' }}>
            Demo login: demo@spicegarden.com / demo123
          </div>
        </div>
      </div>
    </div>
  );
}

function LeftPanel() {
  return (
    <div className="auth-left">
      <div className="auth-left-logo">Menuify</div>
      <div className="auth-left-content">
        <h2>One QR code.<br />Endless possibilities.</h2>
        <p>Join hundreds of restaurants that have said goodbye to paper menus.</p>
      </div>
      <div className="auth-testimonial">
        <p>"We updated our Diwali special menu at 10pm the night before. No printer, no stress."</p>
        <cite>— Rajesh Sharma, Sharma Dhaba, Lucknow</cite>
      </div>
    </div>
  );
}
