import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { messageApi, subscriptionApi } from '../api';

export default function ChatPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [matchInfo, setMatchInfo] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  function getUserId() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id;
    } catch {
      return null;
    }
  }

  const userId = getUserId();

  useEffect(() => {
    loadMessages();

    const token = localStorage.getItem('token');
    if (token) {
      const socket = io('http://localhost:3000', {
        auth: { token },
      });

      socket.on('connect', () => {
        socket.emit('join_match', matchId);
      });

      socket.on('new_message', (msg) => {
        setMessages((prev) => [...prev, msg]);
      });

      socketRef.current = socket;
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_match', matchId);
        socketRef.current.disconnect();
      }
    };
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    setLoading(true);
    setError('');
    try {
      const res = await messageApi.getMessages(matchId);
      const list = res.data?.messages || res.data || [];
      setMessages(Array.isArray(list) ? list : []);
      if (res.data?.match) {
        setMatchInfo(res.data.match);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await messageApi.sendMessage(matchId, input.trim());
      const sentMsg = res.data?.message || res.data;
      if (sentMsg) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === sentMsg.id);
          return exists ? prev : [...prev, sentMsg];
        });
      }
      setInput('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleUnlock() {
    setUnlocking(true);
    setError('');
    try {
      await subscriptionApi.subscribe();
      setMatchInfo((prev) => ({ ...prev, is_unlocked: true }));
      await loadMessages();
    } catch (err) {
      setError(err.message);
    } finally {
      setUnlocking(false);
    }
  }

  const mySentCount = messages.filter((m) => m.sender_id === userId).length;
  const freeMessagesLeft = Math.max(0, 2 - mySentCount);
  const isUnlocked = Boolean(matchInfo?.is_unlocked);
  const isPaywalled = !isUnlocked && freeMessagesLeft === 0;

  return (
    <div className="page chat-container" style={{ paddingBottom: '1rem' }}>
      <div className="chat-header">
        <button 
          onClick={() => navigate('/matches')} 
          className="btn-secondary" 
          style={{ padding: '0.4rem 0.6rem', borderRadius: '50%', width: 36, height: 36 }}
        >
          ←
        </button>

        <div className="avatar" style={{ width: 42, height: 42, overflow: 'hidden' }}>
          {matchInfo?.partner_photo ? (
            <img 
              src={matchInfo.partner_photo.startsWith('http') ? matchInfo.partner_photo : `http://localhost:3000/uploads/${matchInfo.partner_photo}`} 
              alt={matchInfo.partner_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            '💬'
          )}
        </div>

        <div>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>
            {matchInfo?.partner_name || 'Campus Match'}
          </h2>
          <span style={{ fontSize: '0.72rem', color: isUnlocked ? '#00e676' : 'var(--primary-pink)', fontWeight: '600' }}>
            {isUnlocked ? '⚡ Unlimited Messaging Active' : freeMessagesLeft > 0 ? `⚡ ${freeMessagesLeft} Free ${freeMessagesLeft === 1 ? 'Message' : 'Messages'} Left` : '🔒 Free Limit Reached'}
          </span>
        </div>
      </div>

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Loading conversation...</p>
        </div>
      )}

      {error && <p className="error" style={{ margin: '0.5rem 0' }}>{error}</p>}

      {isPaywalled && (
        <div style={{ 
          background: 'rgba(255, 64, 129, 0.12)', 
          border: '1px solid var(--primary-pink)', 
          borderRadius: 'var(--radius-sm)', 
          padding: '0.85rem', 
          margin: '0.5rem 0',
          textAlign: 'center' 
        }}>
          <p style={{ color: '#fff', fontSize: '0.88rem', fontWeight: '600', marginBottom: '0.3rem' }}>
            🔒 2 Free Messages Used
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.6rem' }}>
            Subscribe to unlock unlimited messaging in this match permanently!
          </p>
          <button 
            onClick={handleUnlock}
            className="btn-primary" 
            style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}
            disabled={unlocking}
          >
            {unlocking ? 'Unlocking...' : '⚡ Activate Premium & Unlock'}
          </button>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', margin: 'auto 0', opacity: 0.7 }}>
            <p>No messages yet.</p>
            <p style={{ fontSize: '0.85rem' }}>Send a greeting to start chatting! (2 free messages allowed)</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={msg.id || i}
            className={`msg-bubble ${msg.sender_id === userId ? 'mine' : 'theirs'}`}
          >
            <p>{msg.content}</p>
            <span className="msg-time">
              {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem', flexDirection: 'row' }}>
        <input
          type="text"
          placeholder={isPaywalled ? 'Free message limit reached (2/2)' : 'Type a message...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending || isPaywalled}
          maxLength={2000}
        />
        <button type="submit" className="btn-primary" disabled={sending || !input.trim() || isPaywalled} style={{ padding: '0.85rem 1.2rem' }}>
          {sending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}

