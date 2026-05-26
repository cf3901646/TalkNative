import React, { useEffect, useRef } from 'react';
import { DialogueLine } from '../types';
import { PlayCircle, Volume2 } from 'lucide-react';

interface TranscriptProps {
  lines: DialogueLine[];
  activeId: string | null;
  onLineClick: (id: string) => void;
  isPlaying: boolean;
  currentWordIndex: number;
  wordHighlightEnabled?: boolean;
}

// 消除 markdown 等排版标记，确保纯文本显示
const cleanText = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')       
    .replace(/<\/?b>/gi, '')               
    .replace(/<\/?i>/gi, '')               
    .replace(/<\/?strong>/gi, '');         
};

const Transcript: React.FC<TranscriptProps> = ({ lines, activeId, onLineClick, isPlaying, currentWordIndex, wordHighlightEnabled = true }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 播放行变化时平滑滚动到屏幕中心
  useEffect(() => {
    if (activeId && scrollRef.current) {
      const activeEl = document.getElementById(`line-${activeId}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeId]);

  try {
    return (
      <div className="flex-1 space-y-4 pb-48" ref={scrollRef}>
        {lines.map((line) => {
          const isActive = line.id === activeId;
          const isAlex = line.speaker === 'Alex';
          const englishText = cleanText(line.english);

          return (
            <div
              key={line.id}
              id={`line-${line.id}`}
              onClick={() => onLineClick(line.id)}
              className={`
                group relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer
                ${isActive
                  ? 'bg-white border-slate-200 dark:bg-slate-800 dark:border-indigo-500/50 shadow-[0_4px_25px_rgba(99,102,241,0.12)] scale-[1.01]'
                  : 'bg-white border-slate-100 dark:bg-slate-900/60 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm'
                }
              `}
            >
              {isActive && (
                <div className="absolute left-1.5 top-3.5 bottom-3.5 w-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-pulse" />
              )}
              <div className="flex items-start gap-4">
                
                {/* 1. 圆形首字母头像：完全重置回原版经典的极简清爽文字头像 */}
                <div className={`
                  flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                  ${isAlex
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'}
                `}>
                  {line.speaker ? line.speaker[0] : '?'}
                </div>

                {/* 2. 对话文本工作区 */}
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {line.speaker}
                    </span>
                    {isActive && isPlaying && (
                      <Volume2 size={16} className="text-indigo-500 animate-pulse" />
                    )}
                  </div>

                  {/* 逐词听力高亮：
                      1. 采用经典的黄色荧光笔高亮，对比度超群，清爽夺目。
                      2. 字重保持 100% 物理一致（不改变粗体），无宽度差。
                      3. 彻底移除了 padding (px-0.5) 和 margin (mx-px)，保证物理大小完美恒定。
                      4. 过渡属性限定为 transition-colors，绝不针对尺寸进行动画拉伸。
                      从而实现真正的 100.000% 绝对 0 像素抖动！
                  */}
                  <div className={`text-lg md:text-xl font-bold leading-relaxed ${isActive ? 'text-indigo-950 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    {englishText.split(/(\s+)/).map((part, i, arr) => {
                      const isWord = !/\s+/.test(part);
                      if (!isWord) {
                        return part;
                      }

                      let wordIdx = 0;
                      for (let j = 0; j < i; j++) {
                        if (!/\s+/.test(arr[j])) wordIdx++;
                      }
                      const isHighlighted = wordHighlightEnabled && isActive && isWord && wordIdx === currentWordIndex;

                      return (
                        <span 
                          key={i} 
                          data-word-idx={wordIdx}
                          className={`transition-colors duration-100 rounded ${
                            isHighlighted 
                              ? 'bg-yellow-200 text-slate-900 dark:bg-yellow-200 dark:text-slate-900 px-[2px] mx-[-2px]' 
                              : ''
                          }`}
                        >
                          {part}
                        </span>
                      );
                    })}
                  </div>

                  {/* 中文翻译：恢复原版大字号 text-base */}
                  <p className={`text-base leading-relaxed ${isActive ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                    {line.chinese}
                  </p>

                  {/* 雅思/俚语高频词汇卡片：恢复原版清晰大方的 text-xs px-2 py-1 圆角药丸标签 */}
                  {line.idioms && line.idioms.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                      {line.idioms.map((idiom, idx) => (
                        <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded bg-amber-50/60 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 text-xs font-semibold border border-amber-100/60">
                          💡 {idiom.phrase}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 悬停时的播放按键 */}
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
  } catch (error) {
    console.error("Transcript rendering error:", error);
    return <div className="p-4 text-red-500">剧本显示出错，请刷新重试。</div>;
  }
};

export default Transcript;