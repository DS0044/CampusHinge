import { useState, useEffect } from 'react';
import { adminApi } from '../api';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadReports();
  }, [statusFilter]);

  async function loadReports() {
    setLoading(true);
    try {
      const res = await adminApi.getReports({
        status: statusFilter,
        limit: 100,
      });
      if (res?.data?.reports) {
        setReports(res.data.reports);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(reportId, action) {
    setActionLoading(true);
    try {
      await adminApi.reviewReport(reportId, action);
      // Update locally
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: action } : r))
      );
    } catch (err) {
      alert(err.message || 'Failed to update report status.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBanReportedUser(report) {
    if (!window.confirm(`Are you sure you want to BAN ${report.reported_email || 'this user'}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await adminApi.banUser(report.reported_id);
      await adminApi.reviewReport(report.id, 'reviewed');
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: 'reviewed' } : r))
      );
      alert(`User ${report.reported_email} has been banned.`);
    } catch (err) {
      alert(err.message || 'Ban action failed.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="admin-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Safety & Moderation Queue</h1>
          <p className="page-subtitle">Review peer reports, investigate community guideline violations, and issue penalties</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadReports} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Filter by Resolution Status:
          </span>
          <select
            className="form-input"
            style={{ width: 'auto', padding: '0.5rem 1rem' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Reports (Pending & Resolved)</option>
            <option value="pending">⚠️ Pending Review Only</option>
            <option value="reviewed">✅ Reviewed</option>
            <option value="dismissed">🚫 Dismissed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel">
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Showing {reports.length} moderation cases
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛡️</div>
            <h3>No moderation reports found</h3>
            <p>There are no reports matching the selected filter criteria.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reported Account</th>
                  <th>Infraction Reason</th>
                  <th>Reported By</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Moderator Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="user-names">
                        <span style={{ fontWeight: 600, color: '#fff' }}>
                          {r.reported_email || 'Unknown User'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ID: {r.reported_id}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-pending">
                        {r.reason}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {r.reporter_email || r.reporter_id}
                      </span>
                    </td>
                    <td>
                      {r.status === 'pending' ? (
                        <span className="badge badge-pending">Pending</span>
                      ) : r.status === 'reviewed' ? (
                        <span className="badge badge-active">Resolved</span>
                      ) : (
                        <span className="badge badge-banned">Dismissed</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {r.status === 'pending' ? (
                          <>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleBanReportedUser(r)}
                              disabled={actionLoading}
                            >
                              Ban User
                            </button>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleReview(r.id, 'reviewed')}
                              disabled={actionLoading}
                            >
                              Resolve
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleReview(r.id, 'dismissed')}
                              disabled={actionLoading}
                            >
                              Dismiss
                            </button>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Case Closed
                          </span>
                        )}
                      </div>
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
