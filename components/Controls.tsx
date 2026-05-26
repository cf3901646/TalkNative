import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Home, BookOpen, Loader2 } from 'lucide-react';
import { PlaybackState } from '../types';

interface ControlsProps {
  playbackState: PlaybackState;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onBack: () => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  hasScript: boolean;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  playbackState,
  onPlayPause,
  onNext,
  onPrev,
  onBack,
  playbackRate,
  setPlaybackRate,
  hasScript,
  onToggleSidebar,
  isSidebarOpen
}) => {
  const isPlaying = playbackState === PlaybackState.PLAYING;
  const isLoading = playbackState === PlaybackState.LOADING;
  const speeds = [0.75, 1.0, 1.25, 1.5];

  return (
    <div className="fixed bottom-5 left-4 right-4 max-w-md mx-auto z-50 mb-[env(safe-area-inset-bottom)] transition-all">
      
      {/* 极简自适应手机胶囊播放岛 */}
      <div className="bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl border border-slate-200/50 dark:border-slate-800/80 rounded-[2rem] p-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_35px_rgba(0,0,0,0.4)] flex flex-col gap-3">
        
        {/* 上层控制 */}
        <div className="flex items-center justify-between">
           {/* 左侧：语速切换小药丸 */}
           <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-full p-0.5 border border-slate-200/10">
              {speeds.map(rate => (
                <button
                  key={rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`text-[9px] font-black px-2.5 py-1 rounded-full transition-all ${playbackRate === rate ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
                >
                  {rate === 1.0 ? '1x' : `${rate}x`}
                </button>
              ))}
           </div>

           {/* 中间：核心播放与前后切歌按钮 (大拇指黄金触点) */}
           <div className="flex items-center gap-3">
              <button 
                onClick={onPrev} 
                disabled={!hasScript} 
                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1.5 transition-all active:scale-90 disabled:opacity-30"
              >
                <SkipBack size={18} strokeWidth={2.5} />
              </button>
              
              <button 
                onClick={onPlayPause} 
                className={`
                  flex items-center justify-center w-11 h-11 rounded-full text-white shadow-md transition-all active:scale-90
                  ${isLoading 
                    ? 'bg-indigo-400' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/15'
                  }
                `}
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isPlaying ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" className="ml-0.5" />
                )}
              </button>

              <button 
                onClick={onNext} 
                disabled={!hasScript} 
                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1.5 transition-all active:scale-90 disabled:opacity-30"
              >
                <SkipForward size={18} strokeWidth={2.5} />
              </button>
           </div>
           
           {/* 对称占位 */}
           <div className="w-[85px] invisible"></div>
        </div>

        {/* 下层：底部功能区 */}
        <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
           <button 
             onClick={onBack} 
             className="text-slate-400 hover:text-red-500 transition-colors p-1" 
             title="返回列表"
           >
              <Home size={16} strokeWidth={2.5} />
           </button>
           
           <div className="flex-1 flex justify-center">
              <button 
                onClick={onToggleSidebar}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-all ${
                  isSidebarOpen 
                    ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                <BookOpen size={13} strokeWidth={2.5} />
                <span>知识点笔记</span>
              </button>
           </div>
           
           {/* 对称右侧空隙 */}
           <div className="w-6"></div>
        </div>

      </div>
    </div>
  );
};

export default Controls;