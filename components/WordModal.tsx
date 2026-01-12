import React, { useEffect } from 'react';
import { VocabularyItem } from '../types';
import { Volume2, Plus, Check, Loader2, X } from 'lucide-react';

interface WordModalProps {
  word: string;
  data: VocabularyItem | null;
  loading: boolean;
  onClose: () => void;
  onAdd: (item: VocabularyItem) => void;
  isAdded: boolean;
}

const WordModal: React.FC<WordModalProps> = ({ word, data, loading, onClose, onAdd, isAdded }) => {
  // Auto-play audio when data loads
  useEffect(() => {
    if (data && !loading) {
      speak(data.word);
    }
  }, [data, loading]);

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto transition-opacity animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div className="bg-white dark:bg-slate-900 w-full md:w-[400px] md:rounded-2xl rounded-t-2xl shadow-2xl p-6 pointer-events-auto transform transition-transform animate-slide-up pb-safe-area relative border border-slate-200 dark:border-slate-800">
        
        {/* Close Handle (Mobile) */}
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6 md:hidden" />
        
        {/* Close Button (Desktop) */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hidden md:block"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{word}</h2>
              {loading ? (
                 <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              ) : (
                 <p className="text-slate-500 font-mono text-lg">{data?.ipa}</p>
              )}
            </div>
            
            <div className="flex gap-2">
                <button 
                  onClick={() => speak(word)}
                  className="p-3 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                >
                  <Volume2 size={24} />
                </button>
                
                {!loading && data && (
                  <button 
                    onClick={() => onAdd(data)}
                    disabled={isAdded}
                    className={`
                      p-3 rounded-full transition-all duration-300
                      ${isAdded 
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' 
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-indigo-600 hover:text-white'
                      }
                    `}
                  >
                    {isAdded ? <Check size={24} /> : <Plus size={24} />}
                  </button>
                )}
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            {loading ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-sm font-medium">Google 翻译查询中...</span>
                </div>
                <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              </div>
            ) : (
              data && (
                <div className="animate-fade-in space-y-2">
                   <div className="flex items-baseline gap-2">
                     <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                       {data.translation}
                     </span>
                   </div>
                   <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                     {data.definition}
                   </p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordModal;