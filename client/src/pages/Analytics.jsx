import { useState, useEffect } from 'react';
import { api } from '../api';
import Sidebar from '../components/Sidebar';

export default function Analytics() {
  const [menus, setMenus]         = useState([]);
  const [selected, setSelected]   = useState(null);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    api('GET', '/menus')
      .then(data => {
        setMenus(data.menus);
        if (data.menus.length > 0) {
          setSelected(data.menus[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setStatsLoading(true);
    api('GET', `/analytics/${selected.id}`)
      .then(setStats)
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, [selected]);

  const maxViews = stats?.daily_views?.length
    ? Math.max(...stats.daily_views.map(d => d.views), 1)
    : 1;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>Analytics</h2>
            <p>Track how customers are finding and viewing your menus.</p>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : menus.length === 0 ? (
          <div style={{ padding: '0 40px' }}>
            <div className="analytics-empty">
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <h3>No menus yet</h3>
              <p>Create a menu from the Dashboard to start tracking analytics.</p>
            </div>
          </div>
        ) : (
          <div style={{ padding: '0 40px 40px' }}>
            {/* Menu selector */}
            <div className="analytics-menu-tabs">
              {menus.map(m => (
                <button
                  key={m.id}
                  className={`analytics-tab ${selected?.id === m.id ? 'active' : ''}`}
                  onClick={() => setSelected(m)}
                >
                  {m.restaurant_name || m.name}
                </button>
              ))}
            </div>

            {statsLoading ? (
              <div className="loading"><div className="spinner" /></div>
            ) : stats ? (
              <>
                {/* Summary cards */}
                <div className="stats-row" style={{ padding: 0, marginBottom: 32 }}>
                  <StatCard label="Today"     value={stats.views_today}     sub="menu views today" />
                  <StatCard label="This week" value={stats.views_this_week} sub="views in 7 days" />
                  <StatCard label="All time"  value={stats.views_total}     sub="total views" />
                  <StatCard label="Daily avg"
                    value={stats.daily_views?.length
                      ? Math.round(stats.views_total / Math.max(stats.daily_views.length, 1))
                      : 0}
                    sub="views per active day"
                  />
                </div>

                {/* Daily chart */}
                <div className="analytics-chart-wrap">
                  <h3 style={{ marginBottom: 20 }}>Views — last 30 days</h3>
                  {stats.daily_views?.length === 0 ? (
                    <div className="analytics-no-data">
                      No views recorded yet. Share your menu link or QR code to get started!
                    </div>
                  ) : (
                    <div className="analytics-bar-chart">
                      {stats.daily_views?.map(d => (
                        <div key={d.date} className="analytics-bar-col" title={`${d.date}: ${d.views} views`}>
                          <div
                            className="analytics-bar"
                            style={{ height: `${Math.max((d.views / maxViews) * 160, 4)}px` }}
                          />
                          <div className="analytics-bar-label">
                            {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-val">{value ?? '—'}</div>
      <div className="stat-card-change">{sub}</div>
    </div>
  );
}
