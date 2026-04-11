import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user]);

  return (
    <div className="page-landing">
      {/* NAV */}
      <nav className="nav">
        <div className="nav-logo"><span className="nav-logo-dot" /> MenuQR</div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="/menu/spice-garden" target="_blank" rel="noreferrer">Demo</a>
        </div>
        <div className="nav-cta">
          <button className="btn-ghost" onClick={() => navigate('/auth?mode=login')}>Sign in</button>
          <button className="btn-primary" onClick={() => navigate('/auth?mode=signup')}>Get started free</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-tag">For Indian restaurants</div>
          <h1 className="hero-title">Your menu,<br /><em>always fresh.</em></h1>
          <p className="hero-sub">Create a beautiful digital menu in minutes. One QR code, instant updates — no reprinting, no waiting.</p>
          <div className="hero-actions">
            <button className="btn-primary btn-large" onClick={() => navigate('/auth?mode=signup')}>Create free menu</button>
            <button className="btn-ghost btn-large" onClick={() => window.open('/menu/spice-garden', '_blank')}>See live demo</button>
          </div>
          <p className="hero-note">Free forever · No credit card needed</p>
          <div className="hero-stats">
            <div><div className="stat-num">2 min</div><div className="stat-label">to go live</div></div>
            <div><div className="stat-num">1 QR</div><div className="stat-label">forever</div></div>
            <div><div className="stat-num">∞</div><div className="stat-label">updates</div></div>
          </div>
        </div>
        <div className="hero-right">
          <div className="phone-frame">
            <div className="phone-bar" />
            <div className="phone-content">
              <div className="phone-header">
                <div className="phone-restaurant">Spice Garden</div>
                <div className="phone-tagline">Authentic Indian cuisine since 1995</div>
              </div>
              <div className="phone-menu-section">
                <div className="phone-section-title">Starters</div>
                <div className="phone-item"><div><div className="phone-item-name"><span className="phone-badge veg" />Paneer Tikka</div><div className="phone-item-desc">Marinated cottage cheese</div></div><div className="phone-item-price">₹220</div></div>
                <div className="phone-item"><div><div className="phone-item-name"><span className="phone-badge nonveg" />Chicken 65</div><div className="phone-item-desc">Spicy deep-fried chicken</div></div><div className="phone-item-price">₹280</div></div>
              </div>
              <div className="phone-menu-section">
                <div className="phone-section-title">Mains</div>
                <div className="phone-item"><div><div className="phone-item-name"><span className="phone-badge veg" />Dal Makhani</div><div className="phone-item-desc">Slow-cooked black lentils</div></div><div className="phone-item-price">₹320</div></div>
                <div className="phone-item"><div><div className="phone-item-name"><span className="phone-badge nonveg" />Butter Chicken</div><div className="phone-item-desc">Tomato cream gravy</div></div><div className="phone-item-price">₹380</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-strip" id="features">
        <h2>Everything a restaurant needs. Nothing it doesn't.</h2>
        <div className="features-grid">
          <div className="feature-box"><div className="feature-icon">⚡</div><div className="feature-title">Instant updates</div><p className="feature-desc">Change a price, add a dish, mark something out of stock — live in seconds. No reprints ever.</p></div>
          <div className="feature-box"><div className="feature-icon">🍃</div><div className="feature-title">Veg / Non-veg tags</div><p className="feature-desc">Green dot, red dot — exactly the way your customers expect. Allergen and spice indicators too.</p></div>
          <div className="feature-box"><div className="feature-icon">📊</div><div className="feature-title">Menu analytics</div><p className="feature-desc">See what dishes your customers view most. Know your bestsellers from real data.</p></div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing-section" id="pricing">
        <div className="section-label">Pricing</div>
        <h2 className="section-title">Simple, honest pricing.</h2>
        <div className="pricing-cards">
          <PricingCard name="Free" price="₹0" period="forever" features={['1 menu, up to 30 items','QR code download','Veg / non-veg tags','menuqr.in/[yourname]']} btnClass="btn-plan-outline" onClick={() => navigate('/auth?mode=signup')} btnText="Get started" />
          <PricingCard featured name="Pro" price="₹499" period="per month" features={['Unlimited items & sections','Table QR packs (PDF)','Analytics dashboard','Custom domain','5 menu themes','Priority support']} btnClass="btn-plan-white" onClick={() => navigate('/auth?mode=signup')} btnText="Start free trial" />
          <PricingCard name="Agency" price="₹1,999" period="per month" features={['10 restaurants','White-label branding','Bulk QR PDF export','Dedicated account manager','API access']} btnClass="btn-plan-outline" onClick={() => navigate('/auth?mode=signup')} btnText="Contact sales" />
        </div>
      </section>

      <footer className="footer">
        <div className="footer-logo">MenuQR</div>
        <div className="footer-note">Built for Indian restaurants · Made with care</div>
        <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>© 2026 MenuQR</div>
      </footer>
    </div>
  );
}

function PricingCard({ name, price, period, features, btnClass, onClick, btnText, featured }) {
  return (
    <div className={`pricing-card ${featured ? 'featured' : ''}`}>
      <div className="plan-name">{name}</div>
      <div className="plan-price">{price}</div>
      <div className="plan-period">{period}</div>
      <ul className="plan-features">
        {features.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
      <button className={`btn-plan ${btnClass}`} onClick={onClick}>{btnText}</button>
    </div>
  );
}
