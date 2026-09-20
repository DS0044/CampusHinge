import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { messageApi, getPhotoUrl } from '../api';
import GatedProfileModal from '../components/GatedProfileModal';
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
import { INTENT_CONFIGS, IntentType } from '../constants/intents';

export interface ChatMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  _status?: 'pending' | 'failed' | 'sent';
}

export interface MatchInfo {
  id?: string;
  partner_id?: string;
  partner_name?: string;
  partner_photo?: string | null;
  intent?: IntentType;
  [key: string]: unknown;
}

interface CacheEntry {
  messages: ChatMessage[];
  matchInfo: MatchInfo | null;
  timestamp: number;
}

// ── Client-side message cache (survives page navigation, cleared on tab close) ──
const messageCache = new Map<string, CacheEntry>(); // matchId → { messages, matchInfo, timestamp }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedChat(matchId: string): CacheEntry | null {
  const entry = messageCache.get(matchId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    messageCache.delete(matchId);
    return null;
  }
  return entry;
}

function setCachedChat(matchId: string, messages: ChatMessage[], matchInfo: MatchInfo | null) {
  messageCache.set(matchId, { messages, matchInfo, timestamp: Date.now() });
}

// ── Tiny UUID for optimistic messages ──
let counter = 0;
function tempId(): string {
  return `_temp_${Date.now()}_${++counter}`;
}

// ── Format exact message timestamp in user's local timezone ──
function formatMessageTime(timestamp?: string): string {
  if (!timestamp) return '';
  let str = String(timestamp).trim();
  // Ensure UTC parsing for SQLite timestamps without timezone ("YYYY-MM-DD HH:MM:SS")
  if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const date = new Date(str);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [partnerTyping, setPartnerTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const partnerTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadedFromCache = useRef(false);

  function getUserId(): string | null {
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
  const mergeMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      // If this exact ID already exists, skip
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  // Replace a temp message with the real server-confirmed version
  const confirmMessage = useCallback((tempMsgId: string, realMsg: ChatMessage) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === tempMsgId ? { ...realMsg, _status: 'sent' } : m))
    );
  }, []);

  // Mark a temp message as failed
  const failMessage = useCallback((tempMsgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === tempMsgId ? { ...m, _status: 'failed' } : m))
    );
  }, []);

  const loadMessages = useCallback(async (silent = false) => {
    if (!matchId) return;
    if (!silent) setLoading(true);
    try {
      const res = await messageApi.getMessages(matchId);
      const list = res.data?.messages || res.data || [];
      const serverMessages = Array.isArray(list) ? (list as ChatMessage[]) : [];

      // Merge with any pending/failed messages that aren't on the server yet
      setMessages((prev) => {
        const pendingMsgs = prev.filter((m) => m._status === 'pending' || m._status === 'failed');
        const serverIds = new Set(serverMessages.map((m) => m.id));
        const remainingPending = pendingMsgs.filter((m) => !serverIds.has(m.id));
        return [...serverMessages, ...remainingPending];
      });

      if (res.data?.match) {
        setMatchInfo(res.data.match as unknown as MatchInfo);
      }
    } catch (err: unknown) {
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;

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

    // Listen for incoming messages via Socket.IO (instant path)
    const unsubMessage = onSocketEvent('new_message', (rawMsg: unknown) => {
      const msg = rawMsg as ChatMessage;
      // Use string comparison to handle potential type mismatches (number vs string)
      if (String(msg.match_id) === String(matchId)) {
        mergeMessage(msg);
      }
    });

    // Typing indicators
    const unsubTyping = onSocketEvent('user_typing', (payload: unknown) => {
      const { userId: tid, matchId: mid } = payload as { userId: string; matchId: string };
      if (mid === matchId && tid !== userId) {
        setPartnerTyping(true);
        if (partnerTypingTimeoutRef.current) clearTimeout(partnerTypingTimeoutRef.current);
        partnerTypingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 3000);
      }
    });

    const unsubStopTyping = onSocketEvent('user_stop_typing', (payload: unknown) => {
      const { userId: tid, matchId: mid } = payload as { userId: string; matchId: string };
      if (mid === matchId && tid !== userId) {
        setPartnerTyping(false);
        if (partnerTypingTimeoutRef.current) clearTimeout(partnerTypingTimeoutRef.current);
      }
    });

    // Connection state — silently refresh messages on reconnect
    const unsubConnection = onConnectionStateChange((state) => {
      if (state === 'connected') {
        loadMessages(true); // silent background refresh
      }
    });

    // ── POLLING FALLBACK: Refresh messages every 30 seconds ──
    // Safety net only — Socket.IO handles real-time delivery
    const pollInterval = setInterval(() => {
      loadMessages(true); // silent refresh, no loading spinner
    }, 30000);

    return () => {
      leaveMatch(matchId);
      unsubMessage();
      unsubTyping();
      unsubStopTyping();
      unsubConnection();
      clearInterval(pollInterval);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (partnerTypingTimeoutRef.current) clearTimeout(partnerTypingTimeoutRef.current);
      sendStopTyping(matchId);
    };
  }, [matchId, userId, mergeMessage, loadMessages]);

  // Update cache whenever messages change
  useEffect(() => {
    if (!matchId) return;
    if (messages.length > 0 && matchInfo) {
      // Only cache confirmed messages (not temp/pending ones)
      const confirmed = messages.filter((m) => !m._status || m._status === 'sent');
      setCachedChat(matchId, confirmed, matchInfo);
    }
  }, [messages, matchInfo, matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!matchId) return;
    setInput(e.target.value);
    sendTyping(matchId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (matchId) sendStopTyping(matchId);
    }, 2000);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!matchId || !input.trim()) return;
    setError('');
    sendStopTyping(matchId);

    const messageContent = input.trim();
    setInput('');

    // ══════════════════════════════════════════════════════
    // ⚡ OPTIMISTIC RENDER — show message INSTANTLY (<1ms)
    // ══════════════════════════════════════════════════════
    const optimisticId = tempId();
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      match_id: matchId,
      sender_id: userId || '',
      content: messageContent,
      created_at: new Date().toISOString(),
      _status: 'pending', // Visual indicator: sending...
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    // ── Send via WebSocket (fast path) ──
    try {
      const socket = getSocket();
      if (socket && socket.connected) {
        const savedMessage = await sendMessageViaSocket(matchId, messageContent) as ChatMessage | null;
        if (savedMessage) {
          confirmMessage(optimisticId, savedMessage);
          return;
        }
      }

      // Fallback: send via HTTP
      const res = await messageApi.sendMessage(matchId, messageContent);
      const sentMsg = (res.data?.message || res.data) as ChatMessage;
      if (sentMsg) {
        confirmMessage(optimisticId, sentMsg);
      }
    } catch (err: unknown) {
      failMessage(optimisticId);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  }

  // Retry a failed message
  async function handleRetry(failedMsg: ChatMessage) {
    if (!matchId) return;
    setError('');
    // Update status to pending
    setMessages((prev) =>
      prev.map((m) => (m.id === failedMsg.id ? { ...m, _status: 'pending' } : m))
    );

    try {
      const socket = getSocket();
      if (socket && socket.connected) {
        const savedMessage = await sendMessageViaSocket(matchId, failedMsg.content) as ChatMessage | null;
        if (savedMessage) {
          confirmMessage(failedMsg.id, savedMessage);
          return;
        }
      }
      const res = await messageApi.sendMessage(matchId, failedMsg.content);
      const sentMsg = (res.data?.message || res.data) as ChatMessage;
      if (sentMsg) confirmMessage(failedMsg.id, sentMsg);
    } catch (err: unknown) {
      failMessage(failedMsg.id);
      setError(err instanceof Error ? err.message : 'Retry failed');
    }
  }

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

        <div
          onClick={() => matchInfo?.partner_id && setSelectedUserId(matchInfo.partner_id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: matchInfo?.partner_id ? 'pointer' : 'default',
            flex: 1,
            overflow: 'hidden',
          }}
          title={matchInfo?.partner_id ? 'Click to view full profile' : ''}
        >
          <div className="avatar" style={{ width: 42, height: 42, overflow: 'hidden', flexShrink: 0 }}>
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

          <div style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'nowrap' }}>
              <h2 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {matchInfo?.partner_name || 'Campus Match'}
                {matchInfo?.partner_id && <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>ℹ️</span>}
              </h2>
              {matchInfo?.intent && INTENT_CONFIGS[matchInfo.intent] && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '0.12rem 0.45rem',
                    borderRadius: '9999px',
                    backgroundColor: `${INTENT_CONFIGS[matchInfo.intent].badgeColor}22`,
                    color: INTENT_CONFIGS[matchInfo.intent].badgeColor,
                    border: `1px solid ${INTENT_CONFIGS[matchInfo.intent].badgeColor}44`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {INTENT_CONFIGS[matchInfo.intent].icon} {INTENT_CONFIGS[matchInfo.intent].label}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#00e676', fontWeight: '600' }}>
              💬 Matched {matchInfo?.partner_id && '• Tap for profile'}
            </span>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Loading conversation...</p>
        </div>
      )}

      {error && <p className="error" style={{ margin: '0.5rem 0' }}>{error}</p>}

      <div className="chat-messages">
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', margin: 'auto 0', opacity: 0.7 }}>
            <p>No messages yet.</p>
            <p style={{ fontSize: '0.85rem' }}>Send a greeting to start chatting!</p>
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
                {formatMessageTime(msg.created_at)}
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
          placeholder="Type a message..."
          value={input}
          onChange={handleInputChange}
          maxLength={2000}
        />
        <button type="submit" className="btn-primary" disabled={!input.trim()} style={{ padding: '0.85rem 1.2rem' }}>
          Send
        </button>
      </form>

      {/* Profile Modal */}
      {selectedUserId && (
        <GatedProfileModal
          targetUserId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
