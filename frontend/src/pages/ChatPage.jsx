import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { messageApi, subscriptionApi, getPhotoUrl } from '../api';
import {
  joinMatch,
  leaveMatch,
  sendMessageViaSocket,
  sendTyping,
  sendStopTyping,
  onSocketEvent,
  onConnectionStateChange,
  getSocket,
} from '../socketManager';

// ── Client-side message cache (survives page navigation, cleared on tab close) ──
const messageCache = new Map(); // matchId → { messages, matchInfo, timestamp }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedChat(matchId) {
  const entry = messageCache.get(matchId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    messageCache.delete(matchId);
    return null;
  }
  return entry;
}

function setCachedChat(matchId, messages, matchInfo) {
  messageCache.set(matchId, { messages, matchInfo, timestamp: Date.now() });
}

// ── Tiny UUID for optimistic messages ──
let counter = 0;
function tempId() {
  return `_temp_${Date.now()}_${++counter}`;
}

export default function ChatPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [matchInfo, setMatchInfo] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const partnerTypingTimeoutRef = useRef(null);
  const loadedFromCache = useRef(false);

  function getUserId() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1])).id;
    } catch {
      return null;
    }
  }

  const userId = getUserId();

  // Merge a message into state, replacing temp messages or deduping by ID
  const mergeMessage = useCallback((msg) => {
    setMessages((prev) => {
      // If this exact ID already exists, skip
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  // Replace a temp message with the real server-confirmed version
  const confirmMessage = useCallback((tempMsgId, realMsg) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === tempMsgId ? { ...realMsg, _status: 'sent' } : m))
    );
  }, []);

  // Mark a temp message as failed
  const failMessage = useCallback((tempMsgId) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === tempMsgId ? { ...m, _status: 'failed' } : m))
    );
  }, []);

  useEffect(() => {
    // ── INSTANT LOAD: Check cache first ──
    const cached = getCachedChat(matchId);
    if (cached) {
      setMessages(cached.messages);
      setMatchInfo(cached.matchInfo);
      setLoading(false);
      loadedFromCache.current = true;
      // Refresh in background (non-blocking)
      loadMessages(true);
    } else {
      loadMessages(false);
    }

    // Join this match room
    joinMatch(matchId);

    // Listen for incoming messages
    const unsubMessage = onSocketEvent('new_message', (msg) => {
      if (msg.match_id === matchId) {
        mergeMessage(msg);
      }
    });

    // Typing indicators
    const unsubTyping = onSocketEvent('user_typing', ({ userId: tid, matchId: mid }) => {
      if (mid === matchId && tid !== userId) {
        setPartnerTyping(true);
        clearTimeout(partnerTypingTimeoutRef.current);
        partnerTypingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 3000);
      }
    });

    const unsubStopTyping = onSocketEvent('user_stop_typing', ({ userId: tid, matchId: mid }) => {
      if (mid === matchId && tid !== userId) {
        setPartnerTyping(false);
        clearTimeout(partnerTypingTimeoutRef.current);
      }
    });

    // Connection state
    const unsubConnection = onConnectionStateChange((state) => {
      setConnectionStatus(state);
      if (state === 'connected') {
        loadMessages(true); // silent background refresh
      }
    });

    return () => {
      leaveMatch(matchId);
      unsubMessage();
      unsubTyping();
      unsubStopTyping();
      unsubConnection();
      clearTimeout(typingTimeoutRef.current);
      clearTimeout(partnerTypingTimeoutRef.current);
      sendStopTyping(matchId);
    };
  }, [matchId]);

  // Update cache whenever messages change
  useEffect(() => {
    if (messages.length > 0 && matchInfo) {
      // Only cache confirmed messages (not temp/pending ones)
      const confirmed = messages.filter((m) => !m._status || m._status === 'sent');
      setCachedChat(matchId, confirmed, matchInfo);
    }
  }, [messages, matchInfo, matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  async function loadMessages(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await messageApi.getMessages(matchId);
      const list = res.data?.messages || res.data || [];
      const serverMessages = Array.isArray(list) ? list : [];

      // Merge with any pending/failed messages that aren't on the server yet
      setMessages((prev) => {
        const pendingMsgs = prev.filter((m) => m._status === 'pending' || m._status === 'failed');
        const serverIds = new Set(serverMessages.map((m) => m.id));
        const remainingPending = pendingMsgs.filter((m) => !serverIds.has(m.id));
        return [...serverMessages, ...remainingPending];
      });

      if (res.data?.match) {
        setMatchInfo(res.data.match);
      }
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function handleInputChange(e) {
    setInput(e.target.value);
    sendTyping(matchId);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendStopTyping(matchId), 2000);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setError('');
    sendStopTyping(matchId);

    const messageContent = input.trim();
    setInput('');

    // ══════════════════════════════════════════════════════
    // ⚡ OPTIMISTIC RENDER — show message INSTANTLY (<1ms)
    // ══════════════════════════════════════════════════════
    const optimisticId = tempId();
    const optimisticMsg = {
      id: optimisticId,
      match_id: matchId,
      sender_id: userId,
      content: messageContent,
      created_at: new Date().toISOString(),
      _status: 'pending', // Visual indicator: sending...
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    // ── Send via WebSocket (fast path) ──
    try {
      const socket = getSocket();
      if (socket && socket.connected) {
        const savedMessage = await sendMessageViaSocket(matchId, messageContent);
        if (savedMessage) {
          confirmMessage(optimisticId, savedMessage);
          return;
        }
      }

      // Fallback: send via HTTP
      const res = await messageApi.sendMessage(matchId, messageContent);
      const sentMsg = res.data?.message || res.data;
      if (sentMsg) {
        confirmMessage(optimisticId, sentMsg);
      }
    } catch (err) {
      if (err.message && err.message.includes('Message limit reached')) {
        // Paywall hit — remove optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setError(err.message);
      } else {
        failMessage(optimisticId);
        setError(err.message);
      }
    }
  }

  // Retry a failed message
  async function handleRetry(failedMsg) {
    setError('');
    // Update status to pending
    setMessages((prev) =>
      prev.map((m) => (m.id === failedMsg.id ? { ...m, _status: 'pending' } : m))
    );

    try {
      const socket = getSocket();
      if (socket && socket.connected) {
        const savedMessage = await sendMessageViaSocket(matchId, failedMsg.content);
        if (savedMessage) {
          confirmMessage(failedMsg.id, savedMessage);
          return;
        }
      }
      const res = await messageApi.sendMessage(matchId, failedMsg.content);
      const sentMsg = res.data?.message || res.data;
      if (sentMsg) confirmMessage(failedMsg.id, sentMsg);
    } catch (err) {
      failMessage(failedMsg.id);
      setError(err.message);
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

  const confirmedSentCount = messages.filter((m) => m.sender_id === userId && m._status !== 'failed').length;
  const freeMessagesLeft = Math.max(0, 2 - confirmedSentCount);
  const isUnlocked = Boolean(matchInfo?.is_unlocked);
  const isPaywalled = !isUnlocked && freeMessagesLeft === 0;

  return (
    <div className="page chat-container" style={{ paddingBottom: '1rem' }}>
      {/* Reconnection Banner */}
      {connectionStatus !== 'connected' && (
        <div style={{
          background: connectionStatus === 'connecting'
            ? 'linear-gradient(90deg, #ff9800, #ff5722)'
            : 'linear-gradient(90deg, #f44336, #d32f2f)',
          color: '#fff',
          textAlign: 'center',
          padding: '0.4rem 0.8rem',
          fontSize: '0.78rem',
          fontWeight: '600',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '0.5rem',
          animation: 'pulse 2s infinite',
        }}>
          {connectionStatus === 'connecting' ? '⟳ Reconnecting...' : '⚠ Disconnected — messages may be delayed'}
        </div>
      )}

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
              src={getPhotoUrl(matchInfo.partner_photo)}
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
          <button onClick={handleUnlock} className="btn-primary" style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }} disabled={unlocking}>
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

        {messages.map((msg, i) => {
          const isMine = msg.sender_id === userId;
          const status = msg._status; // 'pending' | 'failed' | 'sent' | undefined (confirmed)

          return (
            <div
              key={msg.id || i}
              className={`msg-bubble ${isMine ? 'mine' : 'theirs'}`}
              style={{
                opacity: status === 'pending' ? 0.7 : status === 'failed' ? 0.5 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              <p>{msg.content}</p>
              <span className="msg-time" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : ''}
                {/* Status indicators for own messages */}
                {isMine && status === 'pending' && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }} title="Sending">◌</span>
                )}
                {isMine && !status && (
                  <span style={{ fontSize: '0.65rem', color: '#00e676' }} title="Sent">✓</span>
                )}
                {isMine && status === 'sent' && (
                  <span style={{ fontSize: '0.65rem', color: '#00e676' }} title="Sent">✓</span>
                )}
                {isMine && status === 'failed' && (
                  <span
                    onClick={() => handleRetry(msg)}
                    style={{ fontSize: '0.65rem', color: '#ff5252', cursor: 'pointer' }}
                    title="Tap to retry"
                  >
                    ⚠ Retry
                  </span>
                )}
              </span>
            </div>
          );
        })}

        {/* Typing indicator */}
        {partnerTyping && (
          <div className="msg-bubble theirs" style={{ opacity: 0.7, fontStyle: 'italic' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="typing-dots">
                <span style={{ animation: 'typingDot 1.4s infinite', animationDelay: '0s' }}>•</span>
                <span style={{ animation: 'typingDot 1.4s infinite', animationDelay: '0.2s' }}>•</span>
                <span style={{ animation: 'typingDot 1.4s infinite', animationDelay: '0.4s' }}>•</span>
              </span>
              typing
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem', flexDirection: 'row' }}>
        <input
          type="text"
          placeholder={isPaywalled ? 'Free message limit reached (2/2)' : 'Type a message...'}
          value={input}
          onChange={handleInputChange}
          disabled={isPaywalled}
          maxLength={2000}
        />
        <button type="submit" className="btn-primary" disabled={!input.trim() || isPaywalled} style={{ padding: '0.85rem 1.2rem' }}>
          Send
        </button>
      </form>
    </div>
  );
}
