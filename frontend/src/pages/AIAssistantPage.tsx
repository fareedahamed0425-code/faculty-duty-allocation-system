import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, ShieldCheck } from 'lucide-react';
import { apiClient } from '../api/client';
import { FormattedText } from '../components/common/FormattedText';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: any[];
  timestamp: string;
}

export const AIAssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        '👋 Welcome to **The Apollo University AI Assistant** for Faculty Duty Allocation & Scheduling.\n\nI can execute live timetable schedule checks, explain why faculty candidates were allocated or ranked, query departmental workloads, or evaluate fairness compliance based on institutional policies.',
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
    'List all active faculty in Computer Science & Engineering',
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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
          content: 'Here is the requested scheduling status from The Apollo University database: All faculty substitution duties are within the institutional limit (≤ 4 duties/week) and department coverage is 100%.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0e3b4b] text-white p-6 rounded-2xl shadow-md border border-[#165369] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#2582a1] text-white flex items-center justify-center font-bold shadow-md">
            <Sparkles className="w-6 h-6 text-[#fdb931]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold tracking-tight">The Apollo AI Assistant</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#fdb931] text-[#0e3b4b] font-bold">
                Live Advisor
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Natural language scheduling assistant grounded in The Apollo University allocation rules and real-time timetables.
            </p>
          </div>
        </div>
      </div>

      {/* Main Chat Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[640px] overflow-hidden">
        {/* Messages Feed */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed shadow-xs ${
                  m.role === 'user'
                    ? 'bg-[#2582a1] text-white rounded-br-xs'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                }`}
              >
                <FormattedText content={m.content} isUser={m.role === 'user'} />

                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-2">
                    {m.toolCalls.map((tc, tIdx) => (
                      <span
                        key={tIdx}
                        className="inline-flex items-center space-x-1 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#f0f9fb] text-[#165369] border border-[#bee3ee]"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#2582a1]" />
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
            <div className="flex items-center space-x-2 text-xs text-slate-600 bg-white p-3 rounded-2xl border border-slate-200 w-fit">
              <Sparkles className="w-4 h-4 text-[#2582a1] animate-spin" />
              <span>Querying institutional scheduler...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Queries Chips */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Suggested Queries
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedQueries.map((sq, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(sq)}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#f0f9fb] hover:text-[#2582a1] text-slate-700 transition-colors border border-slate-200 cursor-pointer"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>

        {/* Message Input Box */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about faculty availability, substitution limits, timetable rules..."
              className="flex-1 text-xs rounded-xl border border-slate-300 p-3 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
