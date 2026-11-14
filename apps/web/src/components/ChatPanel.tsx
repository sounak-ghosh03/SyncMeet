import { useState, useEffect, useRef } from 'react';
import type { ChatMessage, MediaProvider } from '@/lib/media';
import { XIcon, SendIcon } from './Icons';

interface Props {
  provider: MediaProvider;
  localName: string;
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange: (count: number) => void;
}

const MAX_LENGTH = 500;

/**
 * Chat panel using LiveKit data channels.
 *
 * Security:
 * - Messages are rendered as plain text — never set innerHTML (XSS edge case 12.6)
 * - Sender identity comes from LiveKit server, not from the message payload
 * - Messages are capped at MAX_LENGTH on send
 *
 * UX notes:
 * - Late joiners see no history (chat is not persisted — expected; documented in UI)
 * - Unread badge counted when panel is closed
 */
export default function ChatPanel({
  provider,
  localName,
  isOpen,
  onClose,
  onUnreadChange,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [throttled, setThrottled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef(0);
  const lastSentRef = useRef<number>(0);

  // Subscribe to incoming chat messages
  useEffect(() => {
    function handleChat(msg: ChatMessage) {
      setMessages((prev) => [...prev, msg]);

      if (!isOpen) {
        unreadRef.current += 1;
        onUnreadChange(unreadRef.current);
      }
    }

    provider.on('chat', handleChat);
    return () => provider.off('chat', handleChat as (...args: unknown[]) => void);
  }, [provider, isOpen, onUnreadChange]);

  // Reset unread when panel opens
  useEffect(() => {
    if (isOpen) {
      unreadRef.current = 0;
      onUnreadChange(0);
    }
  }, [isOpen, onUnreadChange]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  function handleSend() {
    const text = input.trim();
    if (!text || sending || throttled) return;

    // Throttle: allow max 1 message per 500ms (edge case 12.6 — flooding)
    const now = Date.now();
    if (now - lastSentRef.current < 500) {
      setThrottled(true);
      setTimeout(() => setThrottled(false), 500);
      return;
    }
    lastSentRef.current = now;

    setSending(true);
    provider.sendChat(text.slice(0, MAX_LENGTH));

    // Add own message locally (we don't receive our own data messages)
    const ownMsg: ChatMessage = {
      identity: 'local',
      senderName: localName,
      text: text.slice(0, MAX_LENGTH),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, ownMsg]);
    setInput('');
    setSending(false);
  }

  if (!isOpen) return null;

  return (
    <div
      className="flex flex-col"
      style={{
        width: '300px',
        borderLeft: '1px solid var(--surface-2)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--surface-2)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Chat
        </span>
        <button
          onClick={onClose}
          aria-label="Close chat"
          className="rounded-md p-1 hover:opacity-70"
          style={{ color: 'var(--muted)' }}
        >
          <XIcon size={16} />
        </button>
      </div>

      {/* Late-joiner notice */}
      <div
        className="text-center text-xs py-2 px-3"
        style={{
          background: 'var(--surface-2)',
          color: 'var(--muted)',
          borderBottom: '1px solid var(--surface-2)',
        }}
      >
        Chat history is not saved. Messages before you joined are not visible.
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-xs mt-6" style={{ color: 'var(--muted)' }}>
            No messages yet. Say hello! 👋
          </p>
        )}

        {messages.map((msg, i) => {
          const isOwn = msg.identity === 'local';
          return (
            <div
              key={i}
              className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}
            >
              {/* Sender name + time */}
              <div className="flex items-baseline gap-2">
                {!isOwn && (
                  <span
                    className="text-[11px] font-medium truncate max-w-[140px]"
                    style={{ color: 'var(--accent)' }}
                  >
                    {/* Text content only — prevents XSS (edge case 12.6) */}
                    {msg.senderName}
                  </span>
                )}
                <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>

              {/* Message bubble — rendered as text, never HTML */}
              <div
                className="max-w-[220px] px-3 py-2 rounded-xl text-xs break-words"
                style={{
                  background: isOwn ? 'var(--accent)' : 'var(--surface-2)',
                  color: isOwn ? '#fff' : 'var(--text)',
                  // Use pre-wrap to preserve newlines but NOT HTML rendering
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {/* Render as plain text — textContent equivalent in React */}
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="px-3 py-3 flex gap-2 items-end"
        style={{ borderTop: '1px solid var(--surface-2)' }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message… (Enter to send)"
          rows={1}
          maxLength={MAX_LENGTH}
          className="flex-1 resize-none rounded-lg px-3 py-2 text-xs"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--surface-2)',
            outline: 'none',
            maxHeight: '80px',
            overflowY: 'auto',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending || throttled}
          aria-label="Send message"
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <SendIcon size={15} />
        </button>
      </div>

      {/* Character count */}
      {input.length > MAX_LENGTH * 0.8 && (
        <p className="text-right text-[10px] pb-1 pr-3" style={{ color: 'var(--muted)' }}>
          {input.length}/{MAX_LENGTH}
        </p>
      )}
    </div>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
