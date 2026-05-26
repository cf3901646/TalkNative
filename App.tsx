import React, { useState, useEffect } from 'react';
import { generateLessonScript } from './services/geminiService';
import { LessonData, PlaybackState } from './types';
import Transcript from './components/Transcript';
import Controls from './components/Controls';
import Sidebar from './components/Sidebar';
import { useTTS } from './hooks/useTTS';
import { useLessons } from './hooks/useLessons';
import { useTopics } from './hooks/useTopics';
import { Sparkles, Dices, Clock, Trash2, ArrowRight, Loader2, Star, AlertTriangle, Moon, Sun, Volume2, Github } from 'lucide-react';

function App() {
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'favorites'>('history');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // 新增：极简全自动暗色模式状态
  const [darkMode, setDarkMode] = useState(false);

  // 新增：GitHub 开源致谢弹窗状态
  const [showGithubModal, setShowGithubModal] = useState(false);

  // 新增：逐词高亮开关状态
  const [wordHighlightEnabled, setWordHighlightEnabled] = useState(true);

  // 动态更新移动端状态栏与浏览器标签栏主题色（theme-color），完美适配 iOS/Android 透明状态栏与时间/文字颜色
  useEffect(() => {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const color = darkMode ? '#0b0f19' : '#f8fafc';
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', color);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
    }
  }, [darkMode]);

  const { savedLessons, favorites, saveLesson, deleteLesson, toggleFavorite } = useLessons();
  const { topic, setTopic, isRandomizing, handleRandomTopic } = useTopics();
  const { 
    playbackState, playbackRate, setPlaybackRate, activeLineId, currentWordIndex,
    speak, pause, resume, stop, setActiveLineId, prefetchLines
  } = useTTS(voices);

  // 监听并应用全局暗色模式
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 加载系统发音人
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

  // 核心优化：当用户在播放中切换语速时，立即以新语速重播当前行，避免卡顿与延迟
  useEffect(() => {
    if (playbackState === PlaybackState.PLAYING && activeLineId && lesson) {
      playLine(activeLineId);
    }
  }, [playbackRate]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setError(null);
    setLesson(null);
    stop();

    try {
      const data = await generateLessonScript(topic.trim());
      
      if (!data || !data.lines || data.lines.length === 0) {
        throw new Error("AI 生成的剧本内容为空，请重试。");
      }

      setLesson(data);
      if (data.lines.length > 0) {
        setActiveLineId(data.lines[0].id);
      }
      await saveLesson(data);
    } catch (err: any) {
      console.error("[TalkNative] Generation error:", err);
      setError(err.message || "生成对话失败，请检查网络或稍后重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const playLine = (lineId: string) => {
    if (!lesson) return;
    const idx = lesson.lines.findIndex(l => l.id === lineId);
    if (idx === -1) return;
    const line = lesson.lines[idx];

    prefetchLines(lesson.lines, idx + 1);

    speak(line, () => {
      if (idx < lesson.lines.length - 1) {
        playLine(lesson.lines[idx + 1].id);
      }
    });
  };

  const handlePlayPause = () => {
    if (playbackState === PlaybackState.PLAYING) {
      pause();
    } else if (playbackState === PlaybackState.PAUSED) {
      if (activeLineId && lesson) {
        const line = lesson.lines.find(l => l.id === activeLineId);
        if (line) resume(line);
      }
    } else {
      if (activeLineId && lesson) {
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

  const handleBackToHome = () => {
    stop();
    window.speechSynthesis.cancel();
    setLesson(null);
    setTopic("");
  };

  const handleSelectSaved = (saved: LessonData) => {
    setLesson(saved);
    if (saved.lines.length > 0) {
      setActiveLineId(saved.lines[0].id);
    }
  };

  const speakPhrase = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300 font-sans pb-safe-area pt-safe-area">
      
      {/* 极简顶层逐词高亮切换按钮 (固定于电脑端/移动端右上角，暗色切换左侧) */}
      <button 
        onClick={() => setWordHighlightEnabled(!wordHighlightEnabled)}
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
        className={`fixed md:top-6 md:right-20 right-[60px] z-40 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all ${
          wordHighlightEnabled 
            ? 'text-amber-500 hover:text-amber-600 dark:text-amber-400' 
            : 'text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400'
        }`}
        title={wordHighlightEnabled ? "关闭逐词高亮" : "开启逐词高亮"}
      >
        <Sparkles size={18} />
      </button>

      {/* 极简顶层暗色切换按钮 (固定于电脑端/移动端右上角) */}
      <button 
        onClick={() => setDarkMode(!darkMode)}
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
        className="fixed md:top-6 md:right-6 right-4 z-40 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 shadow-md hover:shadow-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:scale-105 active:scale-95 transition-all"
        title={darkMode ? "切换为日间模式" : "切换为夜间模式"}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <main className="flex-1 flex flex-col items-center relative overflow-hidden">
        <div className="w-full max-w-lg px-4 pb-32">

          {/* 1. 对话未生成首屏页面：极简手机美化 */}
          {!lesson && !isGenerating && (
            <div className="flex flex-col items-center justify-start pt-6 space-y-7 animate-fade-in-up">
              
              {/* 品牌渐变 Logo 和名字 */}
              <div className="flex flex-col items-center gap-4 pt-4 select-none">
                {/* 极简矢量 Speechwave Logo (悬停微气泡提示，点击触发 GitHub 致谢弹窗) */}
                <div 
                  onClick={() => setShowGithubModal(true)}
                  className="relative w-20 h-20 transition-all duration-500 transform hover:scale-105 active:scale-95 cursor-pointer group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm group-hover:drop-shadow-md transition-all duration-300">
                    <defs>
                      <linearGradient id="logo-grad-app" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="60%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#7c3aed" />
                      </linearGradient>
                    </defs>
                    
                    {/* 对话框圆润外廓 */}
                    <path 
                      d="M 50 18 C 65.5 18, 78 30.5, 78 46 C 78 53.5, 75 60.5, 70 65.5 L 74 77 L 62 73 C 58.5 74, 54.5 74.5, 50 74.5 C 34.5 74.5, 22 62, 22 46 C 22 30.5, 34.5 18, 50 18 Z" 
                      stroke="url(#logo-grad-app)" 
                      strokeWidth="5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      fill="none" 
                    />
                    
                    {/* 律动声波柱 */}
                    <g fill="url(#logo-grad-app)">
                      <rect className="transition-all duration-500 origin-[41px_46px] group-hover:scale-y-150" x="38.75" y="35" width="4.5" height="22" rx="2.25" />
                      <rect className="transition-all duration-500 origin-[48.5px_46px] group-hover:scale-y-120 delay-[50ms]" x="46.25" y="29" width="4.5" height="34" rx="2.25" />
                      <rect className="transition-all duration-500 origin-[56px_46px] group-hover:scale-y-160 delay-[100ms]" x="53.75" y="33" width="4.5" height="26" rx="2.25" />
                      <rect className="transition-all duration-500 origin-[63.5px_46px] group-hover:scale-y-130 delay-[150ms]" x="61.25" y="37" width="4.5" height="18" rx="2.25" />
                    </g>
                  </svg>
                  
                  {/* 悬停微交互气泡 Tooltip */}
                  <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-white dark:bg-slate-800 dark:text-slate-100 text-[10px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 shadow-md border border-slate-700/30 z-50">
                    点击直达 GitHub 源码，求颗 ★
                  </div>
                </div>
                
                <div className="text-center">
                  <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">TalkNative</h1>
                  <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">AI 驱动的地道口语练习</p>
                </div>
              </div>

              {/* 输入框：毛玻璃悬浮极简药丸 */}
              <div className="w-full space-y-3 px-1">
                <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-800/80 focus-within:border-slate-300 dark:focus-within:border-slate-700 transition-all flex items-center gap-2">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="输入任意对话情境，例如：面试技巧..."
                    className="flex-1 bg-transparent border-none px-3 py-2.5 focus:outline-none text-sm outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={handleRandomTopic}
                      disabled={isRandomizing}
                      className="p-2.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-xl bg-slate-50 dark:bg-slate-800"
                      title="随机生成"
                    >
                      {isRandomizing ? <Loader2 size={18} className="animate-spin text-indigo-500" /> : <Dices size={18} />}
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={!topic.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 transition-all disabled:opacity-40"
                    >
                      生成
                    </button>
                  </div>
                </div>
              </div>

              {/* 历史记录与习语切换列表 */}
              <div className="w-full px-1 pt-4">
                <div className="flex gap-6 border-b border-slate-200/60 dark:border-slate-800/80 mb-5 text-sm">
                  <button 
                    onClick={() => setActiveTab('history')} 
                    className={`pb-2.5 font-bold transition-all border-b-2 ${activeTab === 'history' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
                  >
                    <div className="flex items-center gap-1.5"><Clock size={14} /> 历史记录</div>
                  </button>
                  
                  <button 
                    onClick={() => setActiveTab('favorites')} 
                    className={`pb-2.5 font-bold transition-all border-b-2 ${activeTab === 'favorites' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Star size={14} /> 习语收藏 
                      <span className="ml-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-[10px] font-black px-1.5 py-0.5 rounded-full">{favorites.length}</span>
                    </div>
                  </button>
                </div>

                {/* 1.1 历史记录卡片流 */}
                {activeTab === 'history' ? (
                  <div className="grid gap-3">
                    {savedLessons.length === 0 ? (
                      <p className="text-center py-14 text-xs font-bold text-slate-400 leading-relaxed">暂无任何离线听力记录，<br/>在上方输入话题开启第一局吧！</p>
                    ) : (
                      savedLessons.map((saved) => (
                        <div 
                          key={saved.id} 
                          onClick={() => handleSelectSaved(saved)} 
                          className="group bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 shadow-sm cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all flex justify-between items-center gap-4"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-200 whitespace-normal break-words leading-relaxed">
                              {saved.topic}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1.5">
                              {new Date(saved.createdAt).toLocaleDateString()} · {saved.lines.length} 句会话
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteLesson(saved.id); }} 
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              title="删除"
                            >
                              <Trash2 size={16} />
                            </button>
                            <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-all group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  /* 1.2 习语收藏卡片流 */
                  <div className="flex flex-col space-y-6">
                    {favorites.length === 0 ? (
                      <p className="text-center py-14 text-xs font-bold text-slate-400 leading-relaxed">还没有收藏任何词汇习语，<br/>在精听对话时随时点击 💡 灯泡即可收藏。</p>
                    ) : (
                      favorites.map((fav, idx) => (
                        <div 
                          key={idx} 
                          className="bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-slate-700 transition-all duration-300 p-6 flex flex-col gap-3.5"
                        >
                          {/* 1. 词汇短语：精致音量按钮，原生字距，护航单词整体图形 */}
                          <div className="flex justify-between items-start gap-4">
                            <button 
                              onClick={() => speakPhrase(fav.phrase)}
                              className="flex items-center gap-3 group/phrase text-left"
                            >
                              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover/phrase:scale-105 active:scale-95 transition-all shrink-0">
                                <Volume2 size={16} />
                              </div>
                              <span className="font-black text-base text-slate-800 dark:text-slate-100 tracking-tight group-hover/phrase:text-indigo-600 dark:group-hover/phrase:text-indigo-400 transition-colors">
                                {fav.phrase}
                              </span>
                            </button>
                            <button 
                              onClick={() => toggleFavorite(fav)} 
                              className="p-1 hover:scale-110 active:scale-95 transition-all shrink-0"
                              title="取消收藏"
                            >
                              <Star size={18} className="fill-amber-400 text-amber-400" />
                            </button>
                          </div>

                          {/* 2. 中文翻译与英文定义：高对比度降低眼肌疲劳 */}
                          <div className="flex flex-col gap-1.5">
                            <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200 tracking-tight">
                              {fav.translation}
                            </p>
                            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                              {fav.definition}
                            </p>
                          </div>

                          {/* 3. 英文例句：从原本拥挤的斜体底色卡片升级为极简左边框，完全移除斜体以保护Bouma轮廓，1.6倍舒适大行高 */}
                          <div className="text-xs border-l-2 border-slate-200 dark:border-slate-800 pl-3 leading-relaxed font-normal text-slate-600 dark:text-slate-400">
                            💡 {fav.usage}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. AI 生成中的全屏加载反馈 */}
          {isGenerating && (
            <div className="fixed inset-0 bg-slate-950/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl max-w-[350px] w-full border border-slate-200/80 dark:border-slate-800/80 shadow-2xl text-center space-y-6 animate-scale-up">
                
                {/* 科技感流光渐变旋转加载光环 + 呼吸Logo */}
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                  {/* 外层流光旋转环 */}
                  <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 border-t-indigo-600 border-r-purple-500 rounded-full animate-spin"></div>
                  
                  {/* 内层微缩呼吸 Logo */}
                  <div className="w-10 h-10 animate-pulse flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full">
                      <defs>
                        <linearGradient id="loadingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="50%" stopColor="#4f46e5" />
                          <stop offset="100%" stopColor="#7c3aed" />
                        </linearGradient>
                      </defs>
                      {/* 规则对话气泡外轮廓 */}
                      <path 
                        d="M 50 15 C 28 15 15 27 15 45 C 15 55 21 65 31 70 C 31 77 24 84 18 87 C 28 87 39 80 44 75 C 46 75 48 75 50 75 C 72 75 85 63 85 45 C 85 27 72 15 50 15 Z" 
                        fill="none" 
                        stroke="url(#loadingGrad)" 
                        strokeWidth="5.5" 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* 四根声波律动柱 (静态在呼吸容器中) */}
                      <rect x="36" y="38" width="4.5" height="24" rx="2.25" fill="url(#loadingGrad)" />
                      <rect x="45" y="30" width="4.5" height="40" rx="2.25" fill="url(#loadingGrad)" />
                      <rect x="54" y="34" width="4.5" height="32" rx="2.25" fill="url(#loadingGrad)" />
                      <rect x="63" y="42" width="4.5" height="16" rx="2.25" fill="url(#loadingGrad)" />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-black text-base text-slate-800 dark:text-white tracking-wide">
                    AI 正在精心编写对话
                    <span className="inline-flex w-5 text-left animate-pulse">...</span>
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed px-1">
                    正在为您生成 50-70 句深度日常对话并高精度合成发音，请稍候
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. 错误提示卡片 */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/60 p-6 rounded-xl text-center my-6">
              <AlertTriangle className="mx-auto text-red-500" size={28} />
              <p className="text-red-600 dark:text-red-400 font-bold mt-2 text-sm">生成失败</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{error}</p>
              <button 
                onClick={() => setError(null)} 
                className="mt-3.5 px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 text-red-600 dark:text-red-300 text-xs font-bold transition-all"
              >
                我知道了，返回重试
              </button>
            </div>
          )}

          {/* 4. 对话激活播放状态：全宽沉浸式手机听读 */}
          {lesson && (
            <div className="animate-fade-in space-y-6">
              {/* 对话顶层面包屑：右侧彻底排空，为悬浮按钮预留呼吸位 */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <button 
                  onClick={handleBackToHome} 
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-black text-slate-700 dark:text-slate-200 active:scale-95 transition-all shadow-sm border border-slate-200/10"
                >
                  <ArrowRight size={13} className="rotate-180 stroke-[2.5]" /> 
                  <span>返回列表</span>
                </button>
                {/* 物理占位，确保右侧在任何窄屏下都不会堆积任何核心文字内容 */}
                <div className="w-24"></div>
              </div>

              {/* 沉浸式场景标题区块：大标题高贵设计，确保绝不遮挡且层级清晰 */}
              <div className="space-y-1 px-1">
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block select-none">当前精听场景</span>
                <h1 className="font-black text-lg text-slate-800 dark:text-white leading-snug tracking-tight">{lesson.topic}</h1>
              </div>

              {/* 对话列表渲染组件 */}
              <Transcript
                lines={lesson.lines}
                activeId={activeLineId}
                onLineClick={(id) => playLine(id)}
                isPlaying={playbackState === PlaybackState.PLAYING}
                currentWordIndex={currentWordIndex}
                wordHighlightEnabled={wordHighlightEnabled}
              />
            </div>
          )}

        </div>
      </main>

      {/* 2. 右侧习语笔记抽屉自适应组件 */}
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

      {/* 3. 手机端大拇指触控胶囊播放岛 */}
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
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          isSidebarOpen={sidebarOpen}
        />
      )}

      {/* 4. GitHub 开源与 Star 引导弹窗：完美对齐 TalkNative 原版高贵极简卡片设计风格 */}
      {showGithubModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* 背景遮罩层：淡雅的半透明黑色，不加重度毛玻璃，符合原始设计风格 */}
          <div 
            onClick={() => setShowGithubModal(false)}
            className="absolute inset-0 bg-slate-950/40 transition-opacity duration-300"
          />
          
          {/* 卡片本体：采用与口语练习卡片、控制台完全对齐的白/深灰背景与边框阴影 */}
          <div className="relative w-full max-w-[340px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-2xl animate-fade-in-up text-center flex flex-col items-center gap-4">
            
            {/* 顶部的 GitHub 八爪鱼立体徽标图标 */}
            <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200">
              <Github size={22} />
            </div>
            
            {/* 标题 */}
            <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">
              开源与 Star 致谢
            </h3>
            
            {/* 内容文案：真诚而温暖 */}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Hi！<span className="font-bold text-indigo-600 dark:text-indigo-400">TalkNative</span> 是一款完全开源、用爱发电的 AI 地道口语学习工具。如果您觉得它对您的英语学习有所帮助，恳请为我们的 GitHub 仓库点亮一颗 Star 🌟，您的认可就是我们持续完善它最大的动力！
            </p>
            
            {/* 对齐原始设计的控制组按钮 */}
            <div className="w-full flex flex-col gap-2.5 mt-2">
              <a 
                href="https://github.com/cf3901646/TalkNative" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={() => setShowGithubModal(false)}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-md active:scale-98 transition-all text-xs flex items-center justify-center gap-1.5"
              >
                <Star size={13} fill="currentColor" />
                去 GitHub 点亮 Star
              </a>
              
              <button 
                onClick={() => setShowGithubModal(false)}
                className="w-full py-2.5 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-98 transition-all text-xs"
              >
                继续口语练习
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;