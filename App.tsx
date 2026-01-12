import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateLessonScript, generateTopicSuggestions } from './services/geminiService';
import { DialogueLine, IdiomNote, LessonData, PlaybackState } from './types';
import Transcript from './components/Transcript';
import Controls from './components/Controls';
import Sidebar from './components/Sidebar';
import { Sparkles, BookOpen, Menu, Info, Dices, Clock, Trash2, ArrowRight, Loader2, Star, Bookmark } from 'lucide-react';

function App() {
  const [topic, setTopic] = useState<string>('');
  const [lesson, setLesson] = useState<LessonData | null>(null);
  
  // Persistence States
  const [savedLessons, setSavedLessons] = useState<LessonData[]>(() => {
    try {
      const saved = localStorage.getItem('lingoflow_lessons');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [favorites, setFavorites] = useState<IdiomNote[]>(() => {
    try {
      const saved = localStorage.getItem('lingoflow_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // Random Topic Management
  const [topicQueue, setTopicQueue] = useState<string[]>([]);
  const [seenTopics, setSeenTopics] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('lingoflow_seen_topics') || '[]');
    } catch { return []; }
  });
  const [isRandomizing, setIsRandomizing] = useState(false);
  const fetchingRef = useRef(false);

  // UI & Playback States
  const [activeTab, setActiveTab] = useState<'history' | 'favorites'>('history');
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [sidebarOpen, setSidebarOpen] = useState(false); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const enVoices = allVoices.filter(v => v.lang.startsWith('en'));
      setVoices(enVoices);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('lingoflow_lessons', JSON.stringify(savedLessons));
  }, [savedLessons]);

  useEffect(() => {
    localStorage.setItem('lingoflow_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (window.innerWidth >= 768) {
      setSidebarOpen(true);
    }
  }, []);

  // Initialize Topic Queue
  useEffect(() => {
     triggerFetch(seenTopics);
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerFetch = async (avoid: string[]) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const newTopics = await generateTopicSuggestions(5, avoid);
      if (newTopics && newTopics.length > 0) {
         setTopicQueue(prev => {
            const existing = new Set([...prev, ...avoid]);
            const uniqueNew = newTopics.filter(t => !existing.has(t));
            return [...prev, ...uniqueNew];
         });
      }
    } catch (e) {
      console.error("Error fetching topics", e);
    } finally {
      fetchingRef.current = false;
    }
  };

  const toggleFavorite = (idiom: IdiomNote) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.phrase === idiom.phrase);
      if (exists) {
        return prev.filter(f => f.phrase !== idiom.phrase);
      } else {
        return [idiom, ...prev];
      }
    });
  };

  const getVoiceForSpeaker = useCallback((speaker: string): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;
    if (speaker === 'Alex') {
       return voices.find(v => v.name.includes("Google US English") || v.name.includes("Male")) || voices[0];
    } else {
       return voices.find(v => (v.name.includes("Google UK English Female") || v.name.includes("Female") || v.name !== voices[0].name)) || voices[Math.min(1, voices.length - 1)];
    }
  }, [voices]);

  const speakPhrase = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const playLine = useCallback((lineId: string) => {
    if (!lesson) return;
    const line = lesson.lines.find(l => l.id === lineId);
    if (!line) return;

    window.speechSynthesis.cancel();
    setActiveLineId(lineId);
    setPlaybackState(PlaybackState.PLAYING);

    const utterance = new SpeechSynthesisUtterance(line.english);
    utterance.rate = playbackRate;
    utterance.lang = 'en-US';
    
    const voice = getVoiceForSpeaker(line.speaker);
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      const currentIndex = lesson.lines.findIndex(l => l.id === lineId);
      if (currentIndex >= 0 && currentIndex < lesson.lines.length - 1) {
        setTimeout(() => {
          if (!window.speechSynthesis.paused && !window.speechSynthesis.speaking) {
             playLine(lesson.lines[currentIndex + 1].id);
          } else if (window.speechSynthesis.paused) {
             // Paused, do nothing
          } else {
             playLine(lesson.lines[currentIndex + 1].id);
          }
        }, 400);
      } else {
        setPlaybackState(PlaybackState.IDLE);
        setActiveLineId(null);
      }
    };

    utterance.onerror = (e) => {
      console.error("TTS Error", e);
      setPlaybackState(PlaybackState.IDLE);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [lesson, playbackRate, getVoiceForSpeaker]);

  const handleRandomTopic = async () => {
    if (isRandomizing) return;
    let nextTopic = "";
    let newQueue = [...topicQueue];

    if (newQueue.length > 0) {
      nextTopic = newQueue.shift()!;
      setTopicQueue(newQueue);
      if (newQueue.length <= 2) {
        triggerFetch([...seenTopics, nextTopic]);
      }
    } else {
      setIsRandomizing(true);
      try {
        const freshTopics = await generateTopicSuggestions(3, seenTopics);
        if (freshTopics.length > 0) {
            nextTopic = freshTopics[0];
            setTopicQueue(freshTopics.slice(1));
        } else {
            nextTopic = "讨论最近的生活变化"; 
        }
      } catch (e) {
        nextTopic = "制定一个旅行计划";
      } finally {
        setIsRandomizing(false);
      }
    }

    if (nextTopic) {
        setTopic(nextTopic);
        const newSeen = [...seenTopics, nextTopic];
        if (newSeen.length > 50) newSeen.shift();
        setSeenTopics(newSeen);
        localStorage.setItem('lingoflow_seen_topics', JSON.stringify(newSeen));
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    setLesson(null);
    setActiveLineId(null);
    setPlaybackState(PlaybackState.IDLE);
    window.speechSynthesis.cancel();

    try {
      const data = await generateLessonScript(topic);
      setLesson(data);
      if (data.lines.length > 0) {
        setActiveLineId(data.lines[0].id);
      }
      setSavedLessons(prev => {
        const newList = [data, ...prev].slice(0, 20); 
        return newList;
      });
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    } catch (err: any) {
      setError(err.message || "生成对话失败，请检查网络或稍后重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBackToHome = () => {
    window.speechSynthesis.cancel();
    setPlaybackState(PlaybackState.IDLE);
    if (lesson) {
      setSavedLessons(prev => {
        const exists = prev.find(l => l.id === lesson.id);
        if (exists) return prev;
        return [lesson, ...prev];
      });
    }
    setLesson(null);
    setTopic("");
  };

  const handleDeleteLesson = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSavedLessons(prev => prev.filter(l => l.id !== id));
  };

  const handleSelectSaved = (saved: LessonData) => {
    setLesson(saved);
    if (saved.lines.length > 0) {
      setActiveLineId(saved.lines[0].id);
    }
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handlePlayPause = () => {
    if (playbackState === PlaybackState.PLAYING) {
      window.speechSynthesis.pause();
      setPlaybackState(PlaybackState.PAUSED);
    } else if (playbackState === PlaybackState.PAUSED) {
      window.speechSynthesis.resume();
      setPlaybackState(PlaybackState.PLAYING);
    } else {
      if (activeLineId) {
        playLine(activeLineId);
      } else if (lesson?.lines.length) {
        playLine(lesson.lines[0].id);
      }
    }
  };

  const handleNext = () => {
    if (!lesson || !activeLineId) return;
    const idx = lesson.lines.findIndex(l => l.id === activeLineId);
    if (idx < lesson.lines.length - 1) {
      playLine(lesson.lines[idx + 1].id);
    }
  };

  const handlePrev = () => {
    if (!lesson || !activeLineId) return;
    const idx = lesson.lines.findIndex(l => l.id === activeLineId);
    if (idx > 0) {
      playLine(lesson.lines[idx - 1].id);
    }
  };

  // Sync Interval
  useEffect(() => {
      const interval = setInterval(() => {
          if (playbackState === PlaybackState.PLAYING && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
              // Check completion logic if needed
          }
      }, 1000);
      return () => clearInterval(interval);
  }, [playbackState]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors font-sans pb-safe-area">
      
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleBackToHome()}>
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Sparkles size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden md:block">LingoFlow 听力流</h1>
            <h1 className="text-xl font-bold tracking-tight md:hidden">LingoFlow</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {lesson && (
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative"
              >
                {sidebarOpen ? <BookOpen size={24} /> : <Menu size={24} />}
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full md:hidden" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex relative overflow-hidden">
        
        {/* Main Content Area */}
        <div className={`flex-1 transition-all duration-300 w-full ${sidebarOpen ? 'md:mr-80' : ''}`}>
          <div className="max-w-3xl mx-auto px-4 py-8 pb-32">
            
            {/* Input & Home Section */}
            {!lesson && !isGenerating && (
              <div className="flex flex-col items-center justify-start pt-6 min-h-[60vh] space-y-8 animate-fade-in-up">
                
                {/* Hero Section */}
                <div className="text-center space-y-4 max-w-lg w-full px-4">
                  <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white">
                    掌握地道英语
                  </h2>
                  <p className="text-base md:text-lg text-slate-600 dark:text-slate-400">
                    AI生成深度对话，或从历史记录开始。
                  </p>
                </div>

                {/* Input Area */}
                <div className="w-full max-w-xl space-y-3 px-2">
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center gap-2">
                    <input 
                      type="text" 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="例如：面试技巧..."
                      className="flex-1 bg-transparent border-none px-4 py-3 focus:outline-none text-slate-900 dark:text-white placeholder-slate-400 text-base"
                      onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    />
                    
                    <div className="flex gap-2">
                        <button
                          onClick={handleRandomTopic}
                          disabled={isRandomizing}
                          className={`
                            flex-1 md:flex-none flex justify-center items-center p-3 
                            text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 
                            transition-colors rounded-xl bg-slate-50 md:bg-transparent 
                            hover:bg-slate-100 dark:hover:bg-slate-800
                            ${isRandomizing ? 'opacity-50 cursor-wait' : ''}
                          `}
                          title="随机话题"
                        >
                          {isRandomizing ? <Loader2 size={24} className="animate-spin text-indigo-500" /> : <Dices size={24} />}
                        </button>

                        <button 
                          onClick={handleGenerate}
                          disabled={isRandomizing}
                          className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-transform active:scale-95 whitespace-nowrap shadow-md disabled:opacity-50"
                        >
                          生成
                        </button>
                    </div>
                  </div>
                </div>

                {/* Content Tabs */}
                <div className="w-full max-w-2xl px-2 mt-8">
                   <div className="flex gap-6 border-b border-slate-200 dark:border-slate-800 mb-6">
                     <button 
                       onClick={() => setActiveTab('history')}
                       className={`pb-3 text-sm font-semibold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'history' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                     >
                       <div className="flex items-center gap-2">
                         <Clock size={16} /> 历史记录
                       </div>
                     </button>
                     <button 
                       onClick={() => setActiveTab('favorites')}
                       className={`pb-3 text-sm font-semibold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'favorites' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                     >
                       <div className="flex items-center gap-2">
                         <Star size={16} /> 习语收藏 ({favorites.length})
                       </div>
                     </button>
                   </div>

                   {/* History List */}
                   {activeTab === 'history' && (
                     <>
                       {savedLessons.length === 0 ? (
                         <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 mx-2">
                           <p>暂无学习记录</p>
                         </div>
                       ) : (
                         <div className="grid gap-3">
                           {savedLessons.map((saved) => (
                             <div 
                               key={saved.id}
                               onClick={() => handleSelectSaved(saved)}
                               className="group bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 active:border-indigo-500 md:hover:border-indigo-500 shadow-sm cursor-pointer transition-all flex justify-between items-center"
                             >
                               <div className="flex items-center gap-3 overflow-hidden">
                                 <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-full text-indigo-600 dark:text-indigo-400 shrink-0">
                                   <Sparkles size={16} />
                                 </div>
                                 <div className="truncate min-w-0">
                                   <p className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm md:text-base">{saved.topic}</p>
                                   <p className="text-xs text-slate-500 mt-0.5">
                                     {new Date(saved.createdAt).toLocaleDateString()} · {saved.lines.length} 句
                                   </p>
                                 </div>
                               </div>
                               
                               <div className="flex items-center gap-2 pl-2">
                                 <button
                                   onClick={(e) => handleDeleteLesson(e, saved.id)}
                                   className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors z-10"
                                 >
                                   <Trash2 size={18} />
                                 </button>
                                 <ArrowRight size={18} className="text-slate-300" />
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                     </>
                   )}

                   {/* Favorites List */}
                   {activeTab === 'favorites' && (
                     <>
                        {favorites.length === 0 ? (
                          <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 mx-2">
                            <p>还没有收藏任何习语</p>
                            <p className="text-xs mt-2">在学习时点击星号收藏</p>
                          </div>
                        ) : (
                          <div className="grid gap-3">
                            {favorites.map((fav, idx) => (
                              <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                  <div 
                                    className="font-bold text-slate-900 dark:text-slate-100 text-lg cursor-pointer hover:text-indigo-600"
                                    onClick={() => speakPhrase(fav.phrase)}
                                    title="点击播放"
                                  >
                                    {fav.phrase}
                                  </div>
                                  <button 
                                    onClick={() => toggleFavorite(fav)}
                                    className="text-amber-400 hover:text-amber-500 p-1"
                                  >
                                    <Star size={20} fill="currentColor" />
                                  </button>
                                </div>
                                
                                <div>
                                  <p className="text-slate-800 dark:text-slate-200 font-medium">
                                    {fav.translation || "暂无中文释义"}
                                  </p>
                                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                                    {fav.definition}
                                  </p>
                                </div>
                                
                                <div className="text-xs text-slate-400 italic border-l-2 border-indigo-200 pl-2 mt-1">
                                  {fav.usage}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                     </>
                   )}

                </div>

              </div>
            )}

            {/* Loading State */}
            {isGenerating && (
               <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
                 <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                 <div className="text-center">
                   <p className="text-lg font-medium text-slate-600 dark:text-slate-300 animate-pulse">
                     AI正在编写剧本...
                   </p>
                   <p className="text-sm text-slate-400 mt-2">约需 10-15 秒，请稍候</p>
                 </div>
               </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-xl text-center my-8 mx-4">
                <p className="text-red-600 dark:text-red-400 font-semibold mb-2">出错了</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{error}</p>
                <button onClick={() => setError(null)} className="text-indigo-600 hover:underline text-sm">重试</button>
              </div>
            )}

            {/* Transcript View */}
            {lesson && (
              <div className="animate-fade-in space-y-4 md:space-y-6">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4 rounded-xl flex items-start gap-3">
                  <Info className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-1" size={20} />
                  <div>
                    <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 text-sm md:text-base">主题：{lesson.topic}</h3>
                    <p className="text-xs md:text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                      点击句子播放。右上角查看笔记。
                    </p>
                  </div>
                </div>

                <Transcript 
                  lines={lesson.lines} 
                  activeId={activeLineId} 
                  onLineClick={playLine}
                  isPlaying={playbackState === PlaybackState.PLAYING}
                />
              </div>
            )}

          </div>
        </div>

        {/* Sidebar */}
        {lesson && (
          <Sidebar 
            lines={lesson.lines} 
            activeLineId={activeLineId} 
            isOpen={sidebarOpen} 
            onClose={() => setSidebarOpen(false)}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
          />
        )}

      </main>

      {/* Footer Controls */}
      {lesson && (
        <Controls 
          playbackState={playbackState}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrev={handlePrev}
          onBack={handleBackToHome}
          playbackRate={playbackRate}
          setPlaybackRate={setPlaybackRate}
          hasScript={!!lesson}
        />
      )}
    </div>
  );
}

export default App;