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

  // Flatten idioms with line ID to track active state
  const allIdiomsWithMeta = lines.flatMap(line => 
    line.idioms.map(idiom => ({ ...idiom, lineId: line.id }))
  );

  const isFavorite = (idiom: IdiomNote) => favorites.some(f => f.phrase === idiom.phrase);

  // Auto-scroll logic
  useEffect(() => {
    if (isOpen && activeLineId && activeCardRef.current) {
       // Scroll the active card into view seamlessly
       activeCardRef.current.scrollIntoView({
         behavior: 'smooth',
         block: 'center',
       });
    }
  }, [activeLineId, isOpen]);

  return (
    <div className={`
      fixed inset-y-0 right-0 w-full md:w-80 bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 z-40 border-l border-slate-200 dark:border-slate-800
      ${isOpen ? 'translate-x-0' : 'translate-x-full'}
    `}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="text-indigo-600 dark:text-indigo-400" size={24} />
            <h2 className="text-xl font-bold dark:text-white">学习笔记</h2>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 pb-32"
        >
          {allIdiomsWithMeta.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-40 text-center">
               <p className="text-slate-400 text-sm">生成对话后<br/>AI将提取重点词汇</p>
             </div>
          ) : (
             allIdiomsWithMeta.map((item, idx) => {
               const isActive = item.lineId === activeLineId;
               // Identify the first active item to attach the ref for scrolling
               const isFirstActive = isActive && (idx === 0 || allIdiomsWithMeta[idx - 1].lineId !== activeLineId);

               return (
                 <div 
                   key={idx} 
                   ref={isFirstActive ? activeCardRef : null}
                   className={`
                     relative p-4 rounded-xl border transition-all duration-500
                     ${isActive 
                       ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500 shadow-md scale-[1.02] ring-1 ring-indigo-200 dark:ring-indigo-800' 
                       : 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 opacity-80 hover:opacity-100'}
                   `}
                 >
                    <div className="flex justify-between items-start mb-1">
                      <p className={`font-bold text-lg ${isActive ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-800 dark:text-slate-200'}`}>
                        {item.phrase}
                      </p>
                      <button 
                        onClick={() => {
                          // Strip lineId before saving to favorites to keep data clean
                          const { lineId, ...cleanIdiom } = item;
                          onToggleFavorite(cleanIdiom);
                        }}
                        className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                      >
                        <Star 
                          size={20} 
                          className={isFavorite(item) ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"} 
                        />
                      </button>
                    </div>
                    
                    <p className="text-base font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {item.translation || "暂无中文释义"}
                    </p>
                    
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                      {item.definition}
                    </p>
                    
                    <div className={`text-xs italic border-l-2 pl-2 ${isActive ? 'text-slate-500 dark:text-slate-400 border-indigo-300' : 'text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                      {item.usage}
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