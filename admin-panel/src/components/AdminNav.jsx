import { NavLink, useNavigate } from 'react-router-dom';
import { clearAdminToken, getAdminUser } from '../api';

export default function AdminNav({ pendingCount = 0 }) {
  const navigate = useNavigate();
  const user = getAdminUser();

  function handleLogout() {
    clearAdminToken();
    navigate('/login');
  }

  return (
    <header className="admin-nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <NavLink to="/dashboard" className="nav-brand">
          <span style={{ fontSize: '1.4rem' }}>🛡️</span>
          <span className="nav-title">CampusHinge</span>
          <span className="nav-brand-badge">ADMIN</span>
        </NavLink>

        <nav className="nav-links">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
          >
            <span>📊</span> Dashboard
          </NavLink>
          <NavLink
            to="/users"
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
          >
            <span>👥</span> Users
          </NavLink>
          <NavLink
            to="/reports"
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
          >
            <span>🚨</span> Reports
            {pendingCount > 0 && (
              <span className="badge badge-banned" style={{ marginLeft: '0.25rem', padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}>
                {pendingCount}
              </span>
            )}
          </NavLink>
        </nav>
      </div>

      <div className="nav-right">
        <div className="live-pill">
          <span className="live-dot"></span>
          <span>API Connected</span>
        </div>

        {user?.email && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {user.email}
          </span>
        )}

        <button className="btn-logout" onClick={handleLogout} title="Sign out">
          Sign Out
        </button>
      </div>
    </header>
  );
}
