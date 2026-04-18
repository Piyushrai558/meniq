import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import Sidebar from "../components/Sidebar";
import Modal from "../components/Modal";
import QRModal from "../components/QRModal";
import UpgradeModal from "../components/UpgradeModal";
import { ToastContext } from "../App";

const PLAN_COLORS = { free: "#8A7B6E", basic: "#2D6A4F", pro: "#7C3AED" };
const PLAN_LABELS = { free: "Free", basic: "Basic", pro: "Pro" };

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [menus, setMenus]         = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newMenuName, setNewMenuName]   = useState("");
  const [newMenuRName, setNewMenuRName] = useState("");
  const [qrModal, setQrModal]     = useState({ open: false, slug: "", menuName: "" });
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [verifyBanner, setVerifyBanner] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    loadData();
    if (user && !user.email_verified) setVerifyBanner(true);
  }, []);

  const loadData = async () => {
    try {
      const data = await api("GET", "/menus");
      setMenus(data.menus);
      if (data.menus.length > 0) {
        const a = await api("GET", `/analytics/${data.menus[0].id}`);
        setAnalytics(a);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createMenu = async () => {
    if (!newMenuName.trim()) { ToastContext.show("Please enter a menu name"); return; }
    try {
      const data = await api("POST", "/menus", { name: newMenuName, restaurant_name: newMenuRName });
      setModalOpen(false);
      setNewMenuName(""); setNewMenuRName("");
      ToastContext.show(`"${newMenuName}" created!`);
      navigate(`/editor/${data.menu.id}`);
    } catch (err) {
      if (err.message.includes("Upgrade") || err.message.includes("plan")) {
        setUpgradeOpen(true);
      }
      ToastContext.show(err.message);
    }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      await api("POST", "/auth/resend-verification");
      ToastContext.show("Verification email sent! Check your inbox.");
    } catch (err) {
      ToastContext.show(err.message);
    } finally {
      setResending(false);
    }
  };

  const greeting = () => {
    const hr = new Date().getHours();
    const g = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
    return `${g}, ${user?.name?.split(" ")[0] || "there"} 👋`;
  };

  const plan        = user?.plan || "free";
  const colors      = ["var(--accent)", "var(--green)", "#4A6FA5", "#7C3AED"];
  const isFreePlan  = plan === "free";
  const menuLimit   = isFreePlan ? 1 : plan === "basic" ? 3 : Infinity;
  const atLimit     = isFreePlan && menus.length >= menuLimit;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">

        {/* Email verification banner */}
        {verifyBanner && !user?.email_verified && (
          <div className="verify-banner">
            <span>📧 Please verify your email address to secure your account.</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button className="verify-banner-btn" onClick={resendVerification} disabled={resending}>
                {resending ? "Sending…" : "Resend email"}
              </button>
              <button className="verify-banner-close" onClick={() => setVerifyBanner(false)}>✕</button>
            </div>
          </div>
        )}

        <div className="page-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h2>{greeting()}</h2>
              <span className="plan-badge" style={{ background: PLAN_COLORS[plan] }}>
                {PLAN_LABELS[plan]}
              </span>
            </div>
            <p>Here's how your restaurant is doing today.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {isFreePlan && (
              <button className="btn-upgrade" onClick={() => setUpgradeOpen(true)}>
                ⚡ Upgrade
              </button>
            )}
            <button className="btn-primary" onClick={() => {
              if (atLimit) { setUpgradeOpen(true); return; }
              setModalOpen(true);
            }}>
              + New Menu
            </button>
          </div>
        </div>

        <div className="stats-row">
          <StatCard label="Views today"      value={analytics.views_today ?? "—"}     sub="menu views" />
          <StatCard label="Views this week"  value={analytics.views_this_week ?? "—"} sub="QR scans" />
          <StatCard label="Active menus"     value={menus.length}                      sub={`of ${menuLimit === Infinity ? "∞" : menuLimit} on ${PLAN_LABELS[plan]}`} />
          <StatCard label="Total views"      value={analytics.views_total ?? "—"}     sub="all time" />
        </div>

        {/* Free plan limit warning */}
        {atLimit && (
          <div className="plan-limit-banner">
            <span>You've used your free menu. <strong>Upgrade</strong> to create up to 3 menus.</span>
            <button className="btn-sm btn-sm-accent" onClick={() => setUpgradeOpen(true)}>Upgrade now</button>
          </div>
        )}

        <div className="section-wrap">
          <div className="section-top">
            <h3>Your menus</h3>
          </div>
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : (
            <div className="menu-cards">
              {menus.map((m, i) => (
                <div className="menu-card" key={m.id}>
                  <div className="menu-card-header" style={{ background: colors[i % colors.length] }}>
                    {m.restaurant_name || m.name}
                  </div>
                  <div className="menu-card-body">
                    <div className="menu-card-name">{m.name}</div>
                    <div className="menu-card-meta">{m.section_count} sections · {m.item_count} items</div>
                    <div className="menu-card-actions">
                      <button className="btn-sm btn-sm-outline"
                        onClick={() => window.open(`/menu/${m.slug}`, "_blank")}>
                        Preview
                      </button>
                      <button className="btn-sm"
                        onClick={() => setQrModal({ open: true, slug: m.slug, menuName: m.restaurant_name || m.name })}>
                        QR
                      </button>
                      <button className="btn-sm btn-sm-accent"
                        onClick={() => navigate(`/editor/${m.id}`)}>
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="menu-card-add" onClick={() => {
                if (atLimit) { setUpgradeOpen(true); return; }
                setModalOpen(true);
              }}>
                <div className="add-icon">{atLimit ? "🔒" : "+"}</div>
                <div className="add-label">{atLimit ? "Upgrade to add more" : "Create new menu"}</div>
              </div>
            </div>
          )}
        </div>

        {/* QR Modal */}
        <QRModal
          open={qrModal.open}
          onClose={() => setQrModal({ open: false, slug: "", menuName: "" })}
          slug={qrModal.slug}
          menuName={qrModal.menuName}
        />

        {/* Upgrade Modal */}
        <UpgradeModal
          open={upgradeOpen}
          onClose={() => { setUpgradeOpen(false); refreshUser(); loadData(); }}
        />

        {/* Create menu modal */}
        <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
          <h3>Create new menu</h3>
          <p>Give your menu a name. You can add sections and items next.</p>
          <div className="form-group">
            <label className="form-label">Menu name</label>
            <input className="form-input" placeholder="e.g. Dinner Menu, Lunch Special…"
              value={newMenuName} onChange={e => setNewMenuName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createMenu()} />
          </div>
          <div className="form-group">
            <label className="form-label">Restaurant name</label>
            <input className="form-input" placeholder="e.g. Spice Garden"
              value={newMenuRName} onChange={e => setNewMenuRName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createMenu()} />
          </div>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={createMenu}>Create menu</button>
          </div>
        </Modal>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-val">{value}</div>
      <div className="stat-card-change">{sub}</div>
    </div>
  );
}
