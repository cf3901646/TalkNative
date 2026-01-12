import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Home } from 'lucide-react';
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
}

const Controls: React.FC<ControlsProps> = ({
  playbackState,
  onPlayPause,
  onNext,
  onPrev,
  onBack,
  playbackRate,
  setPlaybackRate,
  hasScript
}) => {
  const isPlaying = playbackState === PlaybackState.PLAYING;
  const speeds = [0.5, 0.6, 0.75, 1.0, 1.25, 1.5];

  return (
    // Added pb-[env(safe-area-inset-bottom)] for iPhone safe area support
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 shadow-2xl z-50 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-6 w-full md:w-auto">
          <button 
            onClick={onPrev}
            disabled={!hasScript}
            className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 disabled:opacity-30 transition-colors p-2"
            title="上一句"
          >
            <SkipBack size={28} />
          </button>

          <button 
            onClick={onPlayPause}
            disabled={!hasScript}
            className={`
              flex items-center justify-center w-16 h-16 rounded-full text-white shadow-lg transition-all transform hover:scale-105 active:scale-95
              ${isPlaying 
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
              }
              disabled:bg-slate-400
            `}
            title={isPlaying ? "暂停" : "播放"}
          >
            {isPlaying ? (
              <Pause size={32} fill="currentColor" />
            ) : (
              <Play size={32} fill="currentColor" className="ml-1" />
            )}
          </button>

          <button 
            onClick={onNext}
            disabled={!hasScript}
            className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 disabled:opacity-30 transition-colors p-2"
            title="下一句"
          >
            <SkipForward size={28} />
          </button>
        </div>

        {/* Settings */}
        <div className="flex items-center justify-between w-full md:w-auto gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 overflow-x-auto max-w-[70%] md:max-w-none scrollbar-hide">
            {speeds.map((rate) => (
              <button
                key={rate}
                onClick={() => setPlaybackRate(rate)}
                className={`
                  px-2.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap min-w-[2.5rem]
                  ${playbackRate === rate 
                    ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}
                `}
              >
                {rate}x
              </button>
            ))}
          </div>
          
          <button 
            onClick={onBack}
            className="flex items-center gap-1 px-3 py-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="保存并返回主页"
          >
            <Home size={22} />
          </button>
        </div>

      </div>
    </div>
  );
};

export default Controls;