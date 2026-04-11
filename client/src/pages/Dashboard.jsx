import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import { ToastContext } from '../App';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menus, setMenus] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuRName, setNewMenuRName] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const data = await api('GET', '/menus');
      setMenus(data.menus);
      if (data.menus.length > 0) {
        const a = await api('GET', `/analytics/${data.menus[0].id}`);
        setAnalytics(a);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createMenu = async () => {
    if (!newMenuName.trim()) { ToastContext.show('Please enter a menu name'); return; }
    try {
      const data = await api('POST', '/menus', { name: newMenuName, restaurant_name: newMenuRName });
      setModalOpen(false);
      setNewMenuName('');
      setNewMenuRName('');
      ToastContext.show(`"${newMenuName}" created!`);
      navigate(`/editor/${data.menu.id}`);
    } catch (err) {
      ToastContext.show(err.message);
    }
  };

  const greeting = () => {
    const hr = new Date().getHours();
    const g = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    return `${g}, ${user?.name?.split(' ')[0] || 'there'} 👋`;
  };

  const colors = ['var(--accent)', 'var(--green)', '#4A6FA5', '#7C3AED'];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>{greeting()}</h2>
            <p>Here's how your restaurant is doing today.</p>
          </div>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>+ New Menu</button>
        </div>

        <div className="stats-row">
          <StatCard label="Views today" value={analytics.views_today ?? '—'} sub="menu views" />
          <StatCard label="Views this week" value={analytics.views_this_week ?? '—'} sub="QR scans" />
          <StatCard label="Active menus" value={menus.length} sub="live" />
          <StatCard label="Total views" value={analytics.views_total ?? '—'} sub="all time" />
        </div>

        <div className="section-wrap">
          <div className="section-top"><h3>Your menus</h3></div>
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
                      <button className="btn-sm btn-sm-outline" onClick={() => window.open(`/menu/${m.slug}`, '_blank')}>Preview</button>
                      <button className="btn-sm btn-sm-accent" onClick={() => navigate(`/editor/${m.id}`)}>Edit</button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="menu-card-add" onClick={() => setModalOpen(true)}>
                <div className="add-icon">+</div>
                <div className="add-label">Create new menu</div>
              </div>
            </div>
          )}
        </div>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
          <h3>Create new menu</h3>
          <p>Give your menu a name. You can add sections and items next.</p>
          <div className="form-group">
            <label className="form-label">Menu name</label>
            <input className="form-input" placeholder="e.g. Dinner Menu, Lunch Special…" value={newMenuName} onChange={e => setNewMenuName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createMenu()} />
          </div>
          <div className="form-group">
            <label className="form-label">Restaurant name</label>
            <input className="form-input" placeholder="e.g. Spice Garden" value={newMenuRName} onChange={e => setNewMenuRName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createMenu()} />
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
