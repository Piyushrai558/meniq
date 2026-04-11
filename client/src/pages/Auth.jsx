import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ToastContext } from '../App';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, signup, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user]);

  useEffect(() => {
    setIsLogin(searchParams.get('mode') === 'login');
  }, [searchParams]);

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!name.trim()) throw new Error('Please enter your name');
        await signup(email, password, name, restaurantName);
      }
      ToastContext.show('Welcome to MenuQR!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-logo">MenuQR</div>
        <div className="auth-left-content">
          <h2>One QR code.<br />Endless possibilities.</h2>
          <p>Join hundreds of restaurants that have said goodbye to paper menus.</p>
        </div>
        <div className="auth-testimonial">
          <p>"We updated our Diwali special menu at 10pm the night before. No printer, no stress."</p>
          <cite>— Rajesh Sharma, Sharma Dhaba, Lucknow</cite>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-form-wrap">
          <h3>{isLogin ? 'Welcome back' : 'Create your account'}</h3>
          <p>{isLogin ? 'Sign in to your account.' : 'Start for free, no credit card needed.'}</p>

          {error && <div className="auth-error" style={{ display: 'block' }}>{error}</div>}

          {!isLogin && (
            <>
              <div className="form-group">
                <label className="form-label">Restaurant name</label>
                <input className="form-input" placeholder="e.g. Spice Garden" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} onKeyDown={handleKeyDown} />
              </div>
              <div className="form-group">
                <label className="form-label">Your name</label>
                <input className="form-input" placeholder="Rajesh Sharma" value={name} onChange={e => setName(e.target.value)} onKeyDown={handleKeyDown} />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input type="email" className="form-input" placeholder="you@restaurant.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" placeholder={isLogin ? 'Your password' : 'Create a password'} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown} />
          </div>

          <button className="btn-auth" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Please wait...' : isLogin ? 'Sign in' : 'Create free account'}
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
