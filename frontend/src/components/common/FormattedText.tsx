import React from 'react';

interface FormattedTextProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ content, className = '', isUser = false }) => {
  if (!content) return null;

  // Process inline formatting: **bold**, *italic*, `code`
  const renderInline = (text: string): React.ReactNode[] => {
    // Regex for bold **text**, italic *text* or _text_, and code `text`
    const tokens: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*|_.*?_|`.*?`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    let keyCounter = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push(text.substring(lastIndex, match.index));
      }

      const raw = match[0];
      if (raw.startsWith('**') && raw.endsWith('**')) {
        const inner = raw.slice(2, -2);
        tokens.push(
          <strong key={`b-${keyCounter++}`} className={`font-bold ${isUser ? 'text-white' : 'text-slate-900 font-semibold'}`}>
            {inner}
          </strong>
        );
      } else if ((raw.startsWith('*') && raw.endsWith('*')) || (raw.startsWith('_') && raw.endsWith('_'))) {
        const inner = raw.slice(1, -1);
        tokens.push(
          <em key={`i-${keyCounter++}`} className="italic">
            {inner}
          </em>
        );
      } else if (raw.startsWith('`') && raw.endsWith('`')) {
        const inner = raw.slice(1, -1);
        tokens.push(
          <code
            key={`c-${keyCounter++}`}
            className={`px-1.5 py-0.5 rounded font-mono text-[10.5px] ${
              isUser ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#165369] border border-slate-200'
            }`}
          >
            {inner}
          </code>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      tokens.push(text.substring(lastIndex));
    }

    return tokens;
  };

  // Split content into lines for block-level parsing (lists, paragraphs, headers)
  const lines = content.split('\n');

  return (
    <div className={`space-y-1.5 leading-relaxed ${className}`}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={index} className="h-1" />;
        }

        // Check for bullet lists (•, *, -, +)
        const bulletMatch = trimmed.match(/^([•\*\-\+])\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={index} className="flex items-start space-x-2 pl-1">
              <span className={`text-[11px] leading-relaxed select-none ${isUser ? 'text-white/80' : 'text-[#2582a1] font-bold'}`}>
                •
              </span>
              <div className="flex-1">{renderInline(bulletMatch[2])}</div>
            </div>
          );
        }

        // Check for numbered lists (1. , 2. )
        const numberMatch = trimmed.match(/^(\d+[\.\)])\s+(.*)$/);
        if (numberMatch) {
          return (
            <div key={index} className="flex items-start space-x-2 pl-1">
              <span className={`text-[10px] font-bold select-none min-w-[14px] ${isUser ? 'text-white/80' : 'text-[#2582a1]'}`}>
                {numberMatch[1]}
              </span>
              <div className="flex-1">{renderInline(numberMatch[2])}</div>
            </div>
          );
        }

        // Check for headings (###, ##, #)
        const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
        if (headingMatch) {
          return (
            <div
              key={index}
              className={`font-bold tracking-tight mt-2 mb-1 ${
                isUser ? 'text-white' : 'text-[#0e3b4b]'
              }`}
            >
              {renderInline(headingMatch[2])}
            </div>
          );
        }

        // Standard text line
        return <p key={index}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
};
