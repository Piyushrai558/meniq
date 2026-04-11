import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import PublicMenu from './pages/PublicMenu';
import Toast from './components/Toast';
import { useState } from 'react';

export const ToastContext = { show: () => {} };

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/auth?mode=login" />;
}

export default function App() {
  const [toast, setToast] = useState({ msg: '', visible: false });

  ToastContext.show = (msg) => {
    setToast({ msg, visible: true });
    setTimeout(() => setToast({ msg: '', visible: false }), 2500);
  };

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/editor/:menuId" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
        <Route path="/menu/:slug" element={<PublicMenu />} />
      </Routes>
      <Toast message={toast.msg} visible={toast.visible} />
    </>
  );
}
