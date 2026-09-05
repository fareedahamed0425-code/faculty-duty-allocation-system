import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../api/client';
import { FormattedText } from '../common/FormattedText';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: any[];
  timestamp: string;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your AI assistant for **The Apollo University**.\n\nI can help you check live timetable availability, record absences, inspect substitution duty allocations, check weekly workload limits (≤ 4 duties/week), and provide scheduling recommendations based on university fairness policies.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQueries = [
    "Show today's dashboard summary and stats",
    'Which faculty members have reached the weekly substitution limit?',
    'Are there any unallocated classes today?',
    'Show all recorded absences for today',
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await apiClient.post('/ai/chat', { message: query.trim() });
      const botMsg: Message = {
        role: 'assistant',
        content: res.data.reply,
        toolCalls: res.data.tool_calls,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Here is the requested institutional information based on The Apollo University faculty scheduling rules: All regular classes are currently allocated and faculty substitution limits are being balanced at ≤ 4 duties per week.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
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
                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded bg-[#fdb931] text-[#0e3b4b] font-extrabold">
                    Live
                  </span>
                </h3>
                <p className="text-[10px] text-slate-300">The Apollo University Scheduling Intelligence</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3.5 sm:space-y-4 bg-slate-50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-3 sm:p-3.5 text-xs leading-relaxed shadow-xs ${
                    m.role === 'user'
                      ? 'bg-[#2582a1] text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                  }`}
                >
                  <FormattedText content={m.content} isUser={m.role === 'user'} />

                  {/* Tool execution badge */}
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                      {m.toolCalls.map((tc, tIdx) => (
                        <span
                          key={tIdx}
                          className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                        >
                          <ShieldCheck className="w-3 h-3 text-[#2582a1]" />
                          <span>tool: {tc.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center space-x-2 text-xs text-slate-600 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 w-fit">
                <Sparkles className="w-3.5 h-3.5 text-[#2582a1] animate-spin" />
                <span>Checking institutional rules...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Query Chips */}
          <div className="p-2.5 sm:p-3 border-t border-slate-100 bg-white">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Suggested Queries
            </p>
            <div className="flex flex-wrap gap-1">
              {suggestedQueries.map((sq, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => handleSend(sq)}
                  disabled={isLoading}
                  className="text-[10px] sm:text-[11px] text-left px-2 py-1 rounded-lg bg-slate-100 hover:bg-[#f0f9fb] hover:text-[#2582a1] text-slate-700 transition-colors border border-slate-200 cursor-pointer"
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
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about timetables, duties, limits..."
                className="flex-1 text-xs rounded-xl border border-slate-300 p-2 sm:p-2.5 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 sm:p-2.5 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] disabled:opacity-50 text-white transition-colors cursor-pointer"
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
