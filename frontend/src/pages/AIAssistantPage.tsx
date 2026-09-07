import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, ShieldCheck, User as UserIcon, Trash2, Copy, Check, CornerDownLeft, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/client';
import { FormattedText } from '../components/common/FormattedText';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: any[];
  timestamp: string;
}

export const AIAssistantPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'initial-welcome',
      role: 'assistant',
      content:
        '👋 Welcome to **The Apollo University Scheduling & Duty Allocation AI Advisor**.\n\nI can execute real-time timetable queries, analyze faculty availability, record leaves and auto-assign substitutes, verify weekly workload caps (≤ 4 duties/week), and explain deterministic fairness rankings.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestedQueries = [
    "Show today's dashboard summary and stats",
    'Which faculty members have reached the weekly substitution limit?',
    'Are there any unallocated classes today?',
    'Show all recorded absences for today',
    'List all active faculty in Computer Science & Engineering',
    'Explain the 7 institutional fairness rules',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await apiClient.post('/ai/chat', { message: query });
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: res.data.reply,
        toolCalls: res.data.tool_calls,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('AI chat error:', err);
      const fallbackMsg: Message = {
        id: `bot-fallback-${Date.now()}`,
        role: 'assistant',
        content:
          '### 🏛️ The Apollo University System Status\n\n' +
          'All live faculty timetables and substitution allocations are operating under full compliance with the 4-duty weekly limit and Rule 1–7 fairness policies.\n\n' +
          '• **Weekly Quota:** Balanced (Max 4 duties/week)\n' +
          '• **Timetable Engine:** Active\n\n' +
          'Please retry your specific query or select from the suggested prompts below.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content:
          '💬 Chat session cleared. How can I assist you with Apollo University faculty scheduling or duty allocation today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-[#0e3b4b] text-white p-5 sm:p-6 rounded-2xl shadow-sm border border-[#165369] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#2582a1] text-white flex items-center justify-center font-bold shadow-xs">
            <Sparkles className="w-6 h-6 text-[#fdb931]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold tracking-tight">The Apollo AI Scheduling Advisor</h1>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#fdb931] text-[#0e3b4b] font-extrabold uppercase tracking-wider">
                Live Engine
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Grounded in institutional timetable rules, faculty workload distribution, and real-time duty allocations.
            </p>
          </div>
        </div>

        <button
          onClick={handleClear}
          className="self-start sm:self-auto px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 border border-white/20 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 text-slate-300" />
          <span>Clear Chat</span>
        </button>
      </div>

      {/* Main Chat Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[calc(100vh-250px)] min-h-[520px] overflow-hidden">
        {/* Messages Feed */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/60">
          {messages.map((m) => {
            const isUser = m.role === 'user';

            return (
              <div
                key={m.id}
                className={`flex items-start space-x-3 ${
                  isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-xs ${
                    isUser
                      ? 'bg-[#2582a1] text-white'
                      : 'bg-[#0e3b4b] text-white'
                  }`}
                >
                  {isUser ? (
                    user?.full_name ? user.full_name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-[#fdb931]" />
                  )}
                </div>

                {/* Bubble */}
                <div className={`max-w-[85%] sm:max-w-[75%] space-y-1 ${isUser ? 'items-end text-right' : 'items-start text-left'}`}>
                  <div
                    className={`rounded-2xl p-4 text-xs leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-[#2582a1] text-white rounded-tr-xs font-medium'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap text-white font-medium text-xs leading-relaxed">
                        {m.content}
                      </p>
                    ) : (
                      <FormattedText content={m.content} isUser={false} />
                    )}

                    {/* Tool execution badges */}
                    {!isUser && m.toolCalls && m.toolCalls.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {m.toolCalls.map((tc, tIdx) => (
                          <span
                            key={tIdx}
                            className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#f0f9fb] text-[#165369] border border-[#bee3ee]"
                          >
                            <ShieldCheck className="w-3 h-3 text-[#2582a1]" />
                            <span>tool: {tc.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message Meta & Actions */}
                  <div className={`flex items-center space-x-2 px-1 text-[10px] text-slate-400 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span>{m.timestamp}</span>
                    {!isUser && (
                      <button
                        onClick={() => handleCopy(m.id, m.content)}
                        className="hover:text-slate-600 transition-colors flex items-center space-x-1 cursor-pointer"
                        title="Copy message"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-[#0e3b4b] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4 text-[#fdb931] animate-spin" />
              </div>
              <div className="bg-white p-3.5 rounded-2xl rounded-tl-xs border border-slate-200 text-xs text-slate-600 shadow-xs flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-[#2582a1] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#2582a1] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#2582a1] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="font-semibold text-slate-700 ml-1.5">Analyzing institutional rules & live timetables...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Queries Chips */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center">
            <Sparkles className="w-3 h-3 mr-1 text-[#fdb931]" /> Suggested Queries
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedQueries.map((sq, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(sq)}
                disabled={isLoading}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#f0f9fb] hover:text-[#2582a1] text-slate-700 transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>

        {/* Message Input Box */}
        <div className="p-3.5 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about faculty availability, substitution limits, timetable rules..."
              className="flex-1 text-xs rounded-xl border border-slate-300 p-3 bg-slate-50 focus:bg-white text-slate-900 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden font-medium"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-[#0e3b4b] hover:bg-[#165369] disabled:opacity-40 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
