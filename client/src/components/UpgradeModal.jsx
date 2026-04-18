import { useState } from 'react';
import Modal from './Modal';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { ToastContext } from '../App';

const PLANS = [
  {
    id: 'free', name: 'Free', price: 0, period: 'forever',
    features: ['1 menu', 'Up to 15 items', 'QR code generator', 'Basic analytics'],
    cta: null,
  },
  {
    id: 'basic', name: 'Basic', price: 299, period: '/month',
    features: ['3 menus', 'Unlimited items', 'QR code generator', 'Full analytics', 'Email support'],
    cta: 'Upgrade to Basic',
    highlight: false,
  },
  {
    id: 'pro', name: 'Pro', price: 699, period: '/month',
    features: ['Unlimited menus', 'Unlimited items', 'QR code generator', 'Full analytics', 'Custom branding', 'Priority support'],
    cta: 'Upgrade to Pro',
    highlight: true,
  },
];

function loadRazorpay() {
  return new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function UpgradeModal({ open, onClose }) {
  const { user, updateUser } = useAuth();
  const [paying, setPaying] = useState(null); // plan id currently being paid

  const handlePay = async (planId) => {
    setPaying(planId);
    try {
      const order = await api('POST', '/payments/create-order', { plan: planId });

      // ── Dev simulation: no real Razorpay, just verify directly ────────────
      if (order.dev_simulation) {
        const result = await api('POST', '/payments/verify', {
          plan: planId,
          dev_simulation: true,
          razorpay_order_id: order.order_id,
        });
        updateUser(result.user);
        ToastContext.show(`[DEV] Upgraded to ${planId.charAt(0).toUpperCase() + planId.slice(1)}! (simulated — add real Razorpay keys to use real payments)`);
        onClose();
        return;
      }

      // ── Real Razorpay flow ─────────────────────────────────────────────────
      const loaded = await loadRazorpay();
      if (!loaded) { ToastContext.show('Payment gateway failed to load. Check your connection.'); return; }

      const options = {
        key:         order.key_id,
        amount:      order.amount,
        currency:    order.currency,
        name:        'Menuify',
        description: order.plan_name,
        order_id:    order.order_id,
        prefill:     { email: user?.email, name: user?.name },
        theme:       { color: '#C8622A' },
        handler: async (response) => {
          try {
            const result = await api('POST', '/payments/verify', { ...response, plan: planId });
            updateUser(result.user);
            ToastContext.show(`Upgraded to ${planId.charAt(0).toUpperCase() + planId.slice(1)}! Enjoy your new plan.`);
            onClose();
          } catch (err) {
            ToastContext.show('Payment verified but update failed. Please refresh.');
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => ToastContext.show('Payment failed. Please try again.'));
      rzp.open();
    } catch (err) {
      ToastContext.show(err.message || 'Something went wrong');
    } finally {
      setPaying(null);
    }
  };

  const currentPlan = user?.plan || 'free';

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="upgrade-modal">
        <h3>Upgrade your plan</h3>
        <p>Unlock more menus, unlimited items, and advanced features.</p>

        <div className="upgrade-plans">
          {PLANS.map(plan => (
            <div key={plan.id} className={`upgrade-plan-card ${plan.highlight ? 'featured' : ''} ${currentPlan === plan.id ? 'current' : ''}`}>
              {plan.highlight && <div className="upgrade-badge">Most popular</div>}
              {currentPlan === plan.id && <div className="upgrade-badge current-badge">Current plan</div>}
              <div className="upgrade-plan-name">{plan.name}</div>
              <div className="upgrade-plan-price">
                {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                <span className="upgrade-plan-period">{plan.period}</span>
              </div>
              <ul className="upgrade-features">
                {plan.features.map(f => <li key={f}>{f}</li>)}
              </ul>
              {plan.cta && currentPlan !== plan.id && (
                <button
                  className={`btn-plan ${plan.highlight ? 'btn-plan-accent' : 'btn-plan-outline'}`}
                  onClick={() => handlePay(plan.id)}
                  disabled={!!paying}
                >
                  {paying === plan.id ? 'Opening payment…' : plan.cta}
                </button>
              )}
              {currentPlan === plan.id && (
                <div className="upgrade-current-label">Active</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn-ghost" onClick={onClose}>Maybe later</button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-faint)', marginTop: 12 }}>
          Payments powered by Razorpay. Cancel anytime.
        </p>
      </div>
    </Modal>
  );
}
