import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { matchApi, getPhotoUrl } from '../api';
import { onSocketEvent } from '../socketManager';

export default function MatchesPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMatches();

    // Listen for new matches in real-time (e.g. when a mutual like creates a match)
    const unsubNotification = onSocketEvent('notification', (notif) => {
      // Refresh matches list when we get a new notification (could be a new match)
      loadMatches();
    });

    // Listen for new messages to update last_message preview
    const unsubMessage = onSocketEvent('new_message', (msg) => {
      setMatches((prev) =>
        prev.map((m) => {
          const mid = m.match_id || m.id;
          if (String(mid) === String(msg.match_id)) {
            return { ...m, last_message: msg.content, last_message_at: msg.created_at };
          }
          return m;
        })
      );
    });

    return () => {
      unsubNotification();
      unsubMessage();
    };
  }, []);

  async function loadMatches() {
    setLoading(true);
    setError('');
    try {
      const res = await matchApi.getMatches();
      const list = res.data?.matches || res.data || [];
      setMatches(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div style={{ marginBottom: '1.2rem' }}>
        <h1>Matches</h1>
        <p>Your active conversations and new connections.</p>
      </div>

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Loading your matches...</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {!loading && matches.length === 0 && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 1rem', marginTop: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>💌</div>
          <h2 style={{ marginBottom: '0.4rem' }}>No Matches Yet</h2>
          <p style={{ marginBottom: '1.2rem' }}>Keep swiping on the Discover deck to find student matches!</p>
          <button className="btn-primary" onClick={() => navigate('/discover')}>
            Go to Discover
          </button>
        </div>
      )}

      {!loading && matches.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.8rem' }}>
            New Matches & Messages
          </h3>
          <div className="match-grid">
            {matches.map((match) => {
              const name = match.name || match.other_user_name || 'Campus Student';
              const initial = name.charAt(0).toUpperCase();
              const matchId = match.match_id || match.id;

              let avatarPhoto = null;
              if (match.photos) {
                try {
                  const parsed = typeof match.photos === 'string' ? JSON.parse(match.photos) : match.photos;
                  if (Array.isArray(parsed) && parsed.length > 0) avatarPhoto = parsed[0];
                } catch {
                  avatarPhoto = null;
                }
              }

              return (
                <div
                  key={matchId}
                  className="match-card"
                  onClick={() => navigate(`/chat/${matchId}`)}
                >
                  {avatarPhoto ? (
                    <img src={getPhotoUrl(avatarPhoto)} alt={name} className="avatar" />
                  ) : (
                    <div className="avatar">
                      {initial}
                    </div>
                  )}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: '600' }}>{name}</h4>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '0.2rem' }}>
                      {match.last_message || 'Matched! Tap to say hello 👋'}
                    </p>
                  </div>

                  <button 
                    className="btn-primary" 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/chat/${matchId}`);
                    }}
                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', borderRadius: 'var(--radius-full)', gap: '0.3rem', whiteSpace: 'nowrap' }}
                  >
                    Chat 💬
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
