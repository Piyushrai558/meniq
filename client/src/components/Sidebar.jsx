import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initial = user?.name?.charAt(0).toUpperCase() || '?';

  const items = [
    { icon: '▦', label: 'Dashboard',   path: '/dashboard' },
    { icon: '✎', label: 'Menu Editor', path: '/editor' },
    { icon: '↗', label: 'Analytics',   path: '/analytics' },
    { icon: '⚙', label: 'Settings',    path: '/settings' },
  ];

  // Menu Editor needs a menuId — send the user to Dashboard to pick a menu
  const handleClick = (path) => {
    if (path === '/editor') {
      navigate('/dashboard');
    } else {
      navigate(path);
    }
  };

  const isActive = (path) => {
    if (path === '/editor') return location.pathname.startsWith('/editor/');
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">MenuQR</div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <div
            key={item.path}
            className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => handleClick(item.path)}
          >
            <span className="sidebar-icon">{item.icon}</span> {item.label}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div
          className="sidebar-user"
          style={{ cursor: 'pointer' }}
          title="Go to Settings"
          onClick={() => navigate('/settings')}
        >
          <div className="sidebar-avatar">{initial}</div>
          <div style={{ overflow: 'hidden' }}>
            <div className="sidebar-uname">{user?.name}</div>
            <div className="sidebar-uemail">{user?.email}</div>
          </div>
        </div>
        <button
          className="btn-ghost"
          style={{ width: '100%', marginTop: 12, fontSize: 12 }}
          onClick={handleLogout}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
