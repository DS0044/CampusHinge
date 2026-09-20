import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    verifiedUsers: 0,
    bannedUsers: 0,
    totalReports: 0,
    pendingReports: 0,
    totalMatches: 0,
    totalMessages: 0,
  });
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, reportsRes] = await Promise.allSettled([
        adminApi.getStats(),
        adminApi.getReports({ limit: 5, status: 'pending' }),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        setStats(statsRes.value.data);
      }
      if (reportsRes.status === 'fulfilled' && reportsRes.value?.data?.reports) {
        setRecentReports(reportsRes.value.data.reports);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-subtitle">Platform health, user metrics, and pending moderation tasks</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            🔄 Refresh Stats
          </button>
          <Link to="/reports" className="btn btn-primary btn-sm">
            🚨 Moderation Queue
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Users</span>
            <span className="stat-icon">👥</span>
          </div>
          <div className="stat-value">{stats.totalUsers.toLocaleString()}</div>
          <div className="stat-hint">Registered student profiles</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Verified Emails</span>
            <span className="stat-icon" style={{ color: 'var(--status-active)' }}>✅</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--status-active)' }}>
            {stats.verifiedUsers.toLocaleString()}
          </div>
          <div className="stat-hint">
            {stats.totalUsers > 0
              ? `${Math.round((stats.verifiedUsers / stats.totalUsers) * 100)}% verified rate`
              : 'Closed campus domain'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Pending Reports</span>
            <span className="stat-icon" style={{ color: 'var(--status-pending)' }}>⚠️</span>
          </div>
          <div className="stat-value" style={{ color: stats.pendingReports > 0 ? 'var(--status-pending)' : '#fff' }}>
            {stats.pendingReports}
          </div>
          <div className="stat-hint">Awaiting moderator review</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Banned Users</span>
            <span className="stat-icon" style={{ color: 'var(--status-banned)' }}>🚫</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--status-banned)' }}>
            {stats.bannedUsers}
          </div>
          <div className="stat-hint">Accounts currently restricted</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Matches Formed</span>
            <span className="stat-icon" style={{ color: 'var(--accent-purple)' }}>💘</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-purple)' }}>
            {stats.totalMatches.toLocaleString()}
          </div>
          <div className="stat-hint">Mutual student connections</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Messages Exchanged</span>
            <span className="stat-icon" style={{ color: 'var(--status-blue)' }}>💬</span>
          </div>
          <div className="stat-value">{stats.totalMessages.toLocaleString()}</div>
          <div className="stat-hint">Total real-time chat interactions</div>
        </div>
      </div>

      {/* Recent Reports Section */}
      <div className="glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Priority Moderation Queue</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Pending user reports requiring administrative attention
            </p>
          </div>
          <Link to="/reports" className="btn btn-secondary btn-sm">
            View All Reports →
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading moderation queue...
          </div>
        ) : recentReports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛡️</div>
            <h3>Clean Slate! No Pending Reports</h3>
            <p style={{ marginTop: '0.25rem' }}>All user reports have been reviewed and resolved.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reported Account</th>
                  <th>Reason</th>
                  <th>Reported By</th>
                  <th>Report Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentReports.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: '#fff' }}>
                        {r.reported_email || r.reported_id}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-pending">
                        {r.reason}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                        {r.reporter_email || r.reporter_id}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link to="/reports" className="btn btn-primary btn-sm">
                        Review Now
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
