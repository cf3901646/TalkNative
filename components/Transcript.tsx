import React, { useEffect, useRef } from 'react';
import { DialogueLine } from '../types';
import { PlayCircle, Volume2 } from 'lucide-react';

interface TranscriptProps {
  lines: DialogueLine[];
  activeId: string | null;
  onLineClick: (id: string) => void;
  isPlaying: boolean;
}

// 清除所有格式标记：**、<b>、</b> 等，确保纯文本显示
const cleanText = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')       // 去除 **...**
    .replace(/<\/?b>/gi, '')               // 去除 <b> 和 </b>
    .replace(/<\/?i>/gi, '')               // 去除 <i> 和 </i>
    .replace(/<\/?strong>/gi, '');         // 去除 <strong> 和 </strong>
};

const Transcript: React.FC<TranscriptProps> = ({ lines, activeId, onLineClick, isPlaying }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeId && scrollRef.current) {
      const activeEl = document.getElementById(`line-${activeId}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeId]);

  return (
    <div className="flex-1 space-y-6 pb-48" ref={scrollRef}>
      {lines.map((line) => {
        const isActive = line.id === activeId;
        const isAlex = line.speaker === 'Alex';

        return (
          <div
            key={line.id}
            id={`line-${line.id}`}
            onClick={() => onLineClick(line.id)}
            className={`
              group relative p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer
              ${isActive
                ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/20 dark:border-indigo-400 shadow-lg scale-[1.01]'
                : 'bg-white border-transparent hover:border-slate-200 dark:bg-slate-800 dark:hover:border-slate-700 hover:shadow-md'
              }
            `}
          >
            <div className="flex items-start gap-4">
              {/* Avatar / Speaker Icon */}
              <div className={`
                flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                ${isAlex
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'}
              `}>
                {line.speaker[0]}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {line.speaker}
                  </span>
                  {isActive && isPlaying && (
                    <Volume2 size={16} className="text-indigo-500 animate-pulse" />
                  )}
                </div>

                {/* English Text */}
                <p className={`text-lg md:text-xl font-medium leading-relaxed ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                  {cleanText(line.english)}
                </p>

                {/* Chinese Text */}
                <p className={`text-base leading-relaxed ${isActive ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                  {cleanText(line.chinese)}
                </p>

                {/* Idiom Tags */}
                {line.idioms.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    {line.idioms.map((idiom, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 text-xs font-medium">
                        💡 {idiom.phrase}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Hover Play Button */}
            {!isActive && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <PlayCircle size={32} className="text-slate-300 hover:text-indigo-500" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Transcript;