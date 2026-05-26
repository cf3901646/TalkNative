import React, { useEffect, useRef } from 'react';
import { DialogueLine, IdiomNote } from '../types';
import { BookOpen, X, Star } from 'lucide-react';

interface SidebarProps {
  lines: DialogueLine[];
  activeLineId: string | null;
  isOpen: boolean;
  onClose: () => void;
  favorites: IdiomNote[];
  onToggleFavorite: (idiom: IdiomNote) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ lines, activeLineId, isOpen, onClose, favorites, onToggleFavorite }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLDivElement>(null);

  // 展开并追踪属于当前句子的重点习语
  const allIdiomsWithMeta = lines.flatMap(line => 
    line.idioms.map(idiom => ({ ...idiom, lineId: line.id }))
  );

  const isFavorite = (idiom: IdiomNote) => favorites.some(f => f.phrase === idiom.phrase);

  // 播放句意切换时自动平滑滚动笔记至对应卡片
  useEffect(() => {
    if (isOpen && activeLineId && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineId, isOpen]);

  return (
    <div className={`
      fixed inset-y-0 right-0 w-full md:w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl transform transition-transform duration-300 z-40 border-l border-slate-200/60 dark:border-slate-800/80 shadow-2xl
      ${isOpen ? 'translate-x-0' : 'translate-x-full'}
    `}>
      <div className="h-full flex flex-col">
        
        {/* Header: 标题完美换为“俚语重点”，大方干练 */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-transparent z-10">
          <div className="flex items-center gap-2.5">
            <BookOpen className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="text-lg font-black text-slate-800 dark:text-white">知识点笔记</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content: 科学舒适的高内聚卡片流 */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-y-auto px-5 py-6 space-y-6 pb-48 scrollbar-thin"
        >
          {allIdiomsWithMeta.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-slate-400 text-xs leading-relaxed font-bold">
                💡 对话生成后<br/>AI 将在此处自动提取重点词汇
              </p>
            </div>
          ) : (
            allIdiomsWithMeta.map((item, idx) => {
              const isActive = item.lineId === activeLineId;
              const isFirstActive = isActive && (idx === 0 || allIdiomsWithMeta[idx - 1].lineId !== activeLineId);

              return (
                <div 
                  key={idx} 
                  ref={isFirstActive ? activeCardRef : null}
                  className={`
                    relative p-5 rounded-2xl border transition-all duration-300
                    ${isActive 
                      ? 'bg-gradient-to-br from-indigo-50/90 to-indigo-100/40 dark:from-indigo-950/40 dark:to-indigo-950/20 border-indigo-300 dark:border-indigo-700 shadow-md scale-[1.01] ring-1 ring-indigo-200 dark:ring-indigo-900/50' 
                      : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-800/80 shadow-sm hover:border-indigo-200 dark:hover:border-slate-700 hover:shadow-md'
                    }
                  `}
                >
                  {/* 1. 词汇短语：高字重、高清晰度，原生紧缩字距 */}
                  <div className="flex justify-between items-start gap-2">
                    <p className={`font-black text-base tracking-tight ${isActive ? 'text-indigo-950 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100'}`}>
                      {item.phrase}
                    </p>
                    <button 
                      onClick={() => {
                        const { lineId, ...cleanIdiom } = item;
                        onToggleFavorite(cleanIdiom);
                      }}
                      className="p-1 hover:scale-110 active:scale-95 transition-all"
                      title="收藏"
                    >
                      <Star 
                        size={18} 
                        className={isFavorite(item) ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600 hover:text-amber-400"} 
                      />
                    </button>
                  </div>
                  
                  {/* 2. 词汇中文释义：高字重，对比度强 */}
                  <p className={`text-sm font-extrabold mt-1 tracking-tight ${isActive ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>
                    {item.translation || "暂无释义"}
                  </p>
                  
                  {/* 3. 英文定义：提升对比度，拒绝原先极淡的灰蓝字迹，清晰极易视认 */}
                  <p className={`text-xs mt-1.5 leading-relaxed ${isActive ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                    {item.definition}
                  </p>
                  
                  {/* 4. 英文例句：字号从 11px 提升至 text-xs，移除 italic 斜体（保护 Bouma 轮廓），1.6 倍舒适行高 */}
                  <div className={`
                    text-xs border-l-2 pl-3 mt-3.5 leading-relaxed font-normal
                    ${isActive 
                      ? 'text-indigo-900 dark:text-indigo-200 border-indigo-400 dark:border-indigo-500 font-medium' 
                      : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }
                  `}>
                    💡 {item.usage}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;