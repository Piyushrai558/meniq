import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initial = user?.name?.charAt(0).toUpperCase() || '?';

  const items = [
    { icon: '▦', label: 'Dashboard', path: '/dashboard' },
    { icon: '✎', label: 'Menu Editor', path: '/editor' },
    { icon: '↗', label: 'Analytics', path: '/analytics' },
    { icon: '⚙', label: 'Settings', path: '/settings' },
  ];

  const handleClick = (path) => {
    if (path === '/editor' || path === '/analytics' || path === '/settings') {
      navigate('/dashboard');
    } else {
      navigate(path);
    }
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
            className={`sidebar-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
            onClick={() => handleClick(item.path)}
          >
            <span className="sidebar-icon">{item.icon}</span> {item.label}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initial}</div>
          <div>
            <div className="sidebar-uname">{user?.name}</div>
            <div className="sidebar-uemail">{user?.email}</div>
          </div>
        </div>
        <button className="btn-ghost" style={{ width: '100%', marginTop: 12, fontSize: 12 }} onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
