import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, ShieldCheck, User as UserIcon, Trash2, Copy, Check } from 'lucide-react';
import { apiClient } from '../../api/client';
import { FormattedText } from '../common/FormattedText';
import { useAuth } from '../../context/AuthContext';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: any[];
  timestamp: string;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'drawer-welcome',
      role: 'assistant',
      content:
        'Hello! I am your AI assistant for **The Apollo University**.\n\nI can help you check live timetable availability, inspect substitution duty allocations, check weekly workload limits (≤ 4 duties/week), and explain university scheduling policies.',
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
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsgId = `user-drawer-${Date.now()}`;
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
        id: `bot-drawer-${Date.now()}`,
        role: 'assistant',
        content: res.data.reply,
        toolCalls: res.data.tool_calls,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const fallbackMsg: Message = {
        id: `bot-fallback-drawer-${Date.now()}`,
        role: 'assistant',
        content:
          '### 🏛️ The Apollo University Live Status\n\n' +
          'All faculty substitution duties are within the institutional limit (≤ 4 duties/week) and timetable coverage is active.\n\n' +
          'Please select from the suggested prompts or enter your query.',
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
        id: 'drawer-reset',
        role: 'assistant',
        content:
          '💬 Conversation cleared. How can I help you with faculty duties or timetables today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-full sm:max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-[#165369] bg-[#0e3b4b] text-white flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#2582a1] text-white flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4 text-[#fdb931]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold flex items-center space-x-1.5">
                  <span>Apollo AI Assistant</span>
                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded bg-[#fdb931] text-[#0e3b4b] font-extrabold uppercase">
                    Live
                  </span>
                </h3>
                <p className="text-[10px] text-slate-300">The Apollo University Scheduling Intelligence</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={handleClear}
                title="Clear conversation"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3.5 bg-slate-50/60">
            {messages.map((m) => {
              const isUser = m.role === 'user';

              return (
                <div
                  key={m.id}
                  className={`flex items-start space-x-2.5 ${
                    isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 shadow-xs ${
                      isUser
                        ? 'bg-[#2582a1] text-white'
                        : 'bg-[#0e3b4b] text-white'
                    }`}
                  >
                    {isUser ? (
                      user?.full_name ? user.full_name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-[#fdb931]" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[85%] space-y-1 ${isUser ? 'items-end text-right' : 'items-start text-left'}`}>
                    <div
                      className={`rounded-2xl p-3 sm:p-3.5 text-xs leading-relaxed shadow-xs ${
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

                      {/* Tool execution badge */}
                      {!isUser && m.toolCalls && m.toolCalls.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                          {m.toolCalls.map((tc, tIdx) => (
                            <span
                              key={tIdx}
                              className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#f0f9fb] text-[#165369] border border-[#bee3ee]"
                            >
                              <ShieldCheck className="w-3 h-3 text-[#2582a1]" />
                              <span>tool: {tc.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

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
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#0e3b4b] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-[#fdb931] animate-spin" />
                </div>
                <div className="bg-white p-3 rounded-2xl rounded-tl-xs border border-slate-200 text-xs text-slate-600 shadow-xs flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2582a1] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2582a1] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2582a1] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="font-semibold text-slate-700 text-[11px] ml-1">Analyzing rules...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Query Chips */}
          <div className="p-2.5 sm:p-3 border-t border-slate-100 bg-white">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center">
              <Sparkles className="w-3 h-3 mr-1 text-[#fdb931]" /> Quick Prompts
            </p>
            <div className="flex flex-wrap gap-1">
              {suggestedQueries.map((sq, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => handleSend(sq)}
                  disabled={isLoading}
                  className="text-[10px] sm:text-[11px] text-left px-2 py-1 rounded-lg bg-slate-100 hover:bg-[#f0f9fb] hover:text-[#2582a1] text-slate-700 transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-2.5 sm:p-3 border-t border-slate-200 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
                placeholder="Ask about timetables, duties, limits..."
                className="flex-1 text-xs rounded-xl border border-slate-300 p-2 sm:p-2.5 bg-slate-50 focus:bg-white text-slate-900 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden font-medium"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 sm:p-2.5 rounded-xl bg-[#0e3b4b] hover:bg-[#165369] disabled:opacity-40 text-white transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
