import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Home, BookOpen } from 'lucide-react';
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
  // Removed 1.5x
  const speeds = [0.5, 0.75, 1.0, 1.25];
  // Explicitly defined for mobile view requirements
  const mobileSpeeds = [0.5, 0.75, 1.0];

  return (
    <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-auto md:min-w-[500px] z-50 mb-[env(safe-area-inset-bottom)]">
      {/* 
        Updated Styling: 
        - Using consistent Indigo theme for elements.
      */}
      <div className="bg-white/85 dark:bg-black/80 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-3 shadow-[0_0_20px_0_rgba(0,0,0,0.08)] dark:shadow-[0_0_20px_0_rgba(255,255,255,0.05)] ring-1 ring-black/5 dark:ring-white/10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:px-6 md:py-3 transition-all duration-300">
        
        {/* Top Row (Mobile): Playback Controls */}
        <div className="flex items-center justify-between gap-4 md:order-2 md:justify-center md:flex-1">
           {/* Speed Toggle (Mobile Only - 0.5, 0.75, 1.0) */}
           <div className="md:hidden flex items-center bg-black/5 dark:bg-white/10 rounded-full px-1 py-0.5">
              {mobileSpeeds.map(rate => (
                 <button
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-full transition-all ${playbackRate === rate ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}
                 >
                   {rate}x
                 </button>
              ))}
           </div>

           <div className="flex items-center gap-4">
              <button 
                onClick={onPrev}
                disabled={!hasScript}
                className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
              >
                <SkipBack size={26} strokeWidth={1.5} />
              </button>

              <button 
                onClick={onPlayPause}
                disabled={!hasScript}
                className={`
                  flex items-center justify-center w-14 h-14 rounded-full text-white shadow-lg shadow-black/20 dark:shadow-black/50 transition-transform active:scale-95
                  bg-indigo-600 hover:bg-indigo-700
                `}
              >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
              </button>

              <button 
                onClick={onNext}
                disabled={!hasScript}
                className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
              >
                <SkipForward size={26} strokeWidth={1.5} />
              </button>
           </div>
           
           {/* Placeholder to balance flex on mobile */}
           <div className="w-20 md:hidden"></div> 
        </div>

        {/* Bottom Row (Mobile) / Left & Right (Desktop) */}
        <div className="flex items-center justify-between md:contents w-full">
            
            {/* Desktop Speed Controls */}
            <div className="hidden md:flex items-center gap-1 bg-black/5 dark:bg-white/10 rounded-full p-1 md:order-1">
               {speeds.map(rate => (
                  <button
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${playbackRate === rate ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}`}
                  >
                    {rate}
                  </button>
               ))}
            </div>

            {/* Tools */}
            <div className="flex items-center w-full md:w-auto gap-4 md:gap-2 justify-between md:justify-end md:order-3">
               
               <button 
                 onClick={onBack}
                 className="p-3 rounded-full text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 transition-colors md:order-2"
                 title="退出"
               >
                 <Home size={22} strokeWidth={1.5} />
               </button>

               <button 
                  onClick={onToggleSidebar}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-medium transition-colors md:order-1 ${isSidebarOpen ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300' : 'hover:bg-indigo-50 text-slate-600 dark:text-slate-300 dark:hover:bg-indigo-900/20'}`}
               >
                 <BookOpen size={20} strokeWidth={1.5} />
                 <span>笔记</span>
               </button>

            </div>
        </div>

      </div>
    </div>
  );
};

export default Controls;