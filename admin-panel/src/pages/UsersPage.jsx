import { useState, useEffect, useTransition } from 'react';
import { adminApi } from '../api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    loadUsers();
  }, [statusFilter]);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({
        search: search.trim(),
        status: statusFilter,
        limit: 100,
      });
      if (res?.data?.users) {
        setUsers(res.data.users);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadUsers();
  }

  async function handleToggleBan(user) {
    const isCurrentlyBanned = Boolean(user.is_banned);
    const confirmMsg = isCurrentlyBanned
      ? `Unban user ${user.email}? They will regain full access to discover & chat.`
      : `Are you sure you want to BAN user ${user.email}? They will be immediately blocked from the app.`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      if (isCurrentlyBanned) {
        await adminApi.unbanUser(user.id);
      } else {
        await adminApi.banUser(user.id);
      }

      // Update state locally
      startTransition(() => {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, is_banned: isCurrentlyBanned ? 0 : 1 } : u))
        );
        if (selectedUser?.id === user.id) {
          setSelectedUser((prev) => ({ ...prev, is_banned: isCurrentlyBanned ? 0 : 1 }));
        }
      });
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="admin-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Directory</h1>
          <p className="page-subtitle">Manage campus accounts, verify enrollment, and enforce community standards</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadUsers} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {/* Controls Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearchSubmit} className="controls-bar" style={{ margin: 0 }}>
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by name, campus email, or branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              className="form-input"
              style={{ width: 'auto', padding: '0.6rem 1rem' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Account Statuses</option>
              <option value="active">Active Only</option>
              <option value="banned">Banned Only</option>
            </select>

            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Users Table */}
      <div className="glass-panel">
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Showing {users.length} registered campus profiles
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No users found matching your filters</h3>
            <p>Try modifying your search criteria or resetting filters.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Branch / Passout</th>
                  <th>Gender</th>
                  <th>Verification</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const hasPhoto = u.photos && u.photos.length > 0;
                  const firstPhoto = hasPhoto ? u.photos[0] : null;
                  const isBanned = Boolean(u.is_banned);

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          {firstPhoto ? (
                            <img src={firstPhoto} alt="" className="user-avatar" />
                          ) : (
                            <div className="user-avatar">
                              {(u.name?.[0] || u.email?.[0] || 'U').toUpperCase()}
                            </div>
                          )}
                          <div className="user-names">
                            <span className="user-display-name">{u.name || '(No name set)'}</span>
                            <span className="user-email-text">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{u.branch || '—'}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {u.year ? `Class of ${u.year}` : 'Year not set'}
                        </div>
                      </td>
                      <td>
                        <span style={{ textTransform: 'capitalize' }}>{u.gender || '—'}</span>
                      </td>
                      <td>
                        {u.email_verified ? (
                          <span className="badge badge-active">Verified</span>
                        ) : (
                          <span className="badge badge-pending">Unverified</span>
                        )}
                      </td>
                      <td>
                        {isBanned ? (
                          <span className="badge badge-banned">Banned</span>
                        ) : (
                          <span className="badge badge-active">Active</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedUser(u)}
                          >
                            Inspect
                          </button>
                          <button
                            className={`btn btn-sm ${isBanned ? 'btn-success' : 'btn-danger'}`}
                            onClick={() => handleToggleBan(u)}
                            disabled={actionLoading}
                          >
                            {isBanned ? 'Unban' : 'Ban'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Profile Inspection Drawer */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Student Profile</h2>
              <button className="btn-close" onClick={() => setSelectedUser(null)}>✕</button>
            </div>

            {/* Photos */}
            {selectedUser.photos && selectedUser.photos.length > 0 ? (
              <div className="profile-photos-grid">
                {selectedUser.photos.map((p, idx) => (
                  <img key={idx} src={p} alt="" className="profile-photo-thumb" />
                ))}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                No uploaded photos
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{selectedUser.name || 'Anonymous User'}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selectedUser.email}</p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-blue">
                  {selectedUser.branch || 'General'}
                </span>
                {selectedUser.year && (
                  <span className="badge badge-blue">
                    Class of {selectedUser.year}
                  </span>
                )}
                <span className={selectedUser.email_verified ? 'badge badge-active' : 'badge badge-pending'}>
                  {selectedUser.email_verified ? 'Campus Verified' : 'Unverified'}
                </span>
                <span className={selectedUser.is_banned ? 'badge badge-banned' : 'badge badge-active'}>
                  {selectedUser.is_banned ? 'Account Banned' : 'Account Active'}
                </span>
              </div>

              {selectedUser.bio && (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Campus Bio
                  </span>
                  <p style={{ marginTop: '0.35rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    {selectedUser.bio}
                  </p>
                </div>
              )}

              {selectedUser.interests && selectedUser.interests.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Interests & Hobbies
                  </span>
                  <div className="tag-list">
                    {selectedUser.interests.map((t, idx) => (
                      <span key={idx} className="tag-pill">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  className={`btn ${selectedUser.is_banned ? 'btn-success' : 'btn-danger'}`}
                  style={{ width: '100%' }}
                  onClick={() => handleToggleBan(selectedUser)}
                  disabled={actionLoading}
                >
                  {selectedUser.is_banned ? '✅ Unban Student Account' : '🚫 Ban Student Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
