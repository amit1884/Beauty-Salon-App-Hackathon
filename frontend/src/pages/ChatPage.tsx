import { motion } from 'framer-motion';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { ChatActionPayload, ChatUIMessage } from '../lib/api';
import { api } from '../lib/api';
import { normalizeChatResponse, formatActionUserMessage } from '../lib/chatNormalize';
import GenerativeBlock from '../components/chat/GenerativeBlock';

const STARTERS: Record<string, string[]> = {
  customer: [
    'Find hair salons in Mumbai',
    'Show my upcoming bookings',
    'Book a facial near Pune',
  ],
  owner: [
    'Show my earnings this month',
    'Compare earnings Jan vs Feb 2026',
    'Help me add a new salon',
  ],
  admin: [
    'Platform analytics overview',
    'Show pending salon approvals',
    'Top clients by bookings',
  ],
};

export default function ChatPage() {
  const { user } = useAuth();
  const role = user?.role ?? 'customer';
  const [messages, setMessages] = useState<ChatUIMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (
    text: string,
    action?: string,
    actionPayload?: ChatActionPayload,
    actionLabel?: string,
  ) => {
    if (!text.trim() && !action) return;
    const userMsg: ChatUIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: action
        ? formatActionUserMessage(action, actionPayload ?? {}, actionLabel)
        : text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = normalizeChatResponse(await api.agentChat({
        message: text,
        session_id: sessionId,
        action,
        action_payload: actionPayload,
      }));
      setSessionId(res.session_id);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: res.message,
          ui_blocks: res.ui_blocks,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action: string, payload: ChatActionPayload, label?: string) => {
    send('', action, payload, label);
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 max-w-3xl mx-auto w-full">
      <header className="shrink-0 pb-3 mb-1 border-b border-stone-200/80">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-100 text-brand-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-xl md:text-2xl font-semibold text-stone-900">AI Assistant</h1>
              <p className="text-sm text-stone-500 capitalize">
                {role} mode — book, manage, or analyze via chat
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setSessionId(undefined);
                setError(null);
              }}
              className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:border-brand-300 hover:text-brand-700 transition-colors"
            >
              New chat
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-4 pr-1">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/80 p-6">
            <p className="text-sm text-stone-600 mb-4">
              Ask anything or tap a starter — interactive cards in replies let you book or drill down without retyping.
            </p>
            <div className="flex flex-wrap gap-2">
              {(STARTERS[role] ?? STARTERS.customer).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-sm px-3 py-1.5 rounded-full bg-white border border-stone-200 hover:border-brand-300 hover:text-brand-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 shrink-0 rounded-full bg-brand-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-brand-700" />
              </div>
            )}
            <div
              className={`max-w-[85%] space-y-3 ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-2xl rounded-tr-md px-4 py-3'
                  : ''
              }`}
            >
              {msg.role === 'assistant' ? (
                <>
                  <p className="text-stone-800 leading-relaxed">{msg.text}</p>
                  {msg.ui_blocks?.map((block, i) => (
                    <GenerativeBlock
                      key={`${msg.id}-${i}`}
                      block={block}
                      onAction={handleAction}
                      disabled={loading}
                    />
                  ))}
                </>
              ) : (
                <p className="text-sm">{msg.text}</p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 shrink-0 rounded-full bg-stone-200 flex items-center justify-center">
                <User className="w-4 h-4 text-stone-600" />
              </div>
            )}
          </motion.div>
        ))}

        {loading && (
          <div className="flex gap-3 items-center text-stone-500 text-sm">
            <Bot className="w-4 h-4 animate-pulse" />
            Thinking…
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="shrink-0 pt-2 pb-20 md:pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl bg-white px-2 py-1.5 shadow-sm ring-1 ring-stone-200/70 focus-within:ring-2 focus-within:ring-brand-300/60 transition-shadow">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about salons, bookings, earnings…"
            className="flex-1 min-w-0 border-0 bg-transparent px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-0"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-brand-600 text-white disabled:opacity-40 hover:bg-brand-700 transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
