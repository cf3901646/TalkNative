/**
 * useTTS — 工业级双轨自适应语音合成与高精度逐词高亮引擎
 * 1. 优先尝试云端高保真音频 (/api/tts，支持 Google Cloud Journey 拟人声线及分段无缝流)
 * 2. 自动降级至浏览器原生 Web Speech API
 * 3. 根治“开关知识点笔记高亮卡死”：
 *    - 采用高频时间轴轮询器（Ticker）直读真实音频时钟，即便抽屉动画/重排干扰也绝不卡顿
 *    - 引入全局 window 引用驻留，彻底防御 Chromium 垃圾回收（GC）提前销毁 Utterance 的经典宿命缺陷
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { PlaybackState, DialogueLine } from '../types';

interface WordTiming {
  word: string;
  start: number;
  duration: number;
}

interface TTSResponse {
  audio: string;
  words: WordTiming[];
  engine?: string;
}

let audioCtx: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;

const getAudioContext = () => {
  if (!audioCtx || audioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
};

const ttsCache = new Map<string, TTSResponse>();
const prefetchQueue = new Set<string>();

// 根据文本字符长度分布加权生成精确的单词时间轴
function generateWordTimings(text: string, totalDurationSec: number): WordTiming[] {
  const rawWords = text.trim().split(/\s+/);
  if (rawWords.length === 0) return [];
  
  // 按照每个单词的真实音节/字符长度加权（长词更慢，短词更快）
  const weights = rawWords.map(w => {
    const cleanW = w.replace(/[^a-zA-Z]/g, '');
    return Math.max(2, cleanW.length);
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let curTime = 0;
  return rawWords.map((word, i) => {
    const dur = (weights[i] / totalWeight) * totalDurationSec;
    const item = {
      word,
      start: curTime,
      duration: dur
    };
    curTime += dur;
    return item;
  });
}

async function fetchTTS(text: string, speaker: string, rate: number): Promise<TTSResponse> {
  const cacheKey = `${speaker}:${rate}:${text}`;
  if (ttsCache.has(cacheKey)) return ttsCache.get(cacheKey)!;

  const resp = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speaker, rate }),
  });

  if (!resp.ok) throw new Error(`TTS 请求失败: ${resp.status}`);
  const data = await resp.json() as TTSResponse;
  ttsCache.set(cacheKey, data);
  return data;
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

const cleanText = (text?: string): string =>
  String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/<\/?[biBIstrongSTRONG]+>/g, '');

export function useTTS(voices: SpeechSynthesisVoice[] = []) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);

  const requestIdRef = useRef<number>(0);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startCtxTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const currentTimingsRef = useRef<WordTiming[]>([]);
  const onEndRef = useRef<(() => void) | null>(null);
  const isWebSpeechPlayingRef = useRef<boolean>(false);
  const tickerIntervalRef = useRef<any>(null);
  const activeWordIdxRef = useRef<number>(-1);

  // 清除高亮时钟定时器
  const stopHighlightTicker = useCallback(() => {
    if (tickerIntervalRef.current) {
      clearInterval(tickerIntervalRef.current);
      tickerIntervalRef.current = null;
    }
  }, []);

  // 启动基于真实时钟的高精度时间轴追踪器（每 40ms 直读一次当前播放进度，抗任何 UI 重排与弹窗干扰）
  const startHighlightTicker = useCallback((isWebSpeech: boolean) => {
    stopHighlightTicker();

    tickerIntervalRef.current = setInterval(() => {
      const timings = currentTimingsRef.current;
      if (!timings || timings.length === 0) return;

      let elapsed = 0;
      if (isWebSpeech) {
        elapsed = (Date.now() / 1000) - startCtxTimeRef.current;
      } else {
        const ctx = getAudioContext();
        elapsed = (ctx.currentTime - startCtxTimeRef.current) + pauseOffsetRef.current;
      }

      // 智能区间匹配：当前单词持续高亮直到下一个单词开讲，彻底杜绝逗号或音节短暂停顿时的高亮脱节
      let matched = -1;
      for (let i = 0; i < timings.length; i++) {
        const t = timings[i];
        const nextStart = (i < timings.length - 1) ? timings[i + 1].start : (t.start + t.duration + 0.3);
        if (elapsed >= t.start && elapsed < nextStart) {
          matched = i;
          break;
        }
      }

      // 若已经越过最后单词的起止点
      if (matched === -1 && timings.length > 0 && elapsed >= timings[timings.length - 1].start) {
        matched = timings.length - 1;
      }

      if (matched !== -1 && matched !== activeWordIdxRef.current) {
        activeWordIdxRef.current = matched;
        setCurrentWordIndex(matched);
      }
    }, 40);
  }, [stopHighlightTicker]);

  const stop = useCallback(() => {
    stopHighlightTicker();
    
    // 停止 Web Audio
    if (activeSource) {
      try {
        activeSource.onended = null;
        activeSource.stop();
      } catch (_) {}
      activeSource = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      } catch (_) {}
      sourceRef.current = null;
    }

    // 停止原生 Web Speech
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    isWebSpeechPlayingRef.current = false;
    (window as any).__talknative_utterance = null;

    setPlaybackState(PlaybackState.IDLE);
    setCurrentWordIndex(-1);
    activeWordIdxRef.current = -1;
    pauseOffsetRef.current = 0;
  }, [stopHighlightTicker]);

  // 组件卸载时释放所有音频资源
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // 原生 Web Speech 兜底（配备 GC 强力防御与防卡顿时钟）
  const speakWithWebSpeech = useCallback((
    text: string,
    speaker: string,
    rate: number,
    onEnd?: () => void
  ) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setPlaybackState(PlaybackState.IDLE);
      onEnd?.();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    // 【防御核心】：挂载到全局 window，彻底杜绝 Chromium 在 React 重排时将 utterance 提前回收引发静默卡死
    (window as any).__talknative_utterance = utterance;

    utterance.lang = 'en-US';
    const effectiveRate = Math.max(0.6, Math.min(1.8, rate));
    utterance.rate = effectiveRate;

    // 智能选取匹配发音人
    const candidateVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
    const isAlex = speaker === 'Alex';

    let selectedVoice: SpeechSynthesisVoice | null = null;
    if (isAlex) {
      selectedVoice = candidateVoices.find(v => /guy|david|male|george|james|tom|mark/i.test(v.name)) ||
                      candidateVoices.find(v => v.lang === 'en-US') ||
                      candidateVoices[0] || null;
    } else {
      selectedVoice = candidateVoices.find(v => /jenny|zira|female|samantha|aria|victoria|karen/i.test(v.name)) ||
                      candidateVoices.find(v => v.lang === 'en-US' && v !== selectedVoice) ||
                      candidateVoices[0] || null;
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    const wordsCount = text.trim().split(/\s+/).length;
    const estimatedTotalSec = Math.max(1.2, (wordsCount * 0.38) / effectiveRate);
    const selfTimings = generateWordTimings(text, estimatedTotalSec);
    currentTimingsRef.current = selfTimings;

    utterance.onstart = () => {
      isWebSpeechPlayingRef.current = true;
      setPlaybackState(PlaybackState.PLAYING);
      startCtxTimeRef.current = Date.now() / 1000;
      startHighlightTicker(true);
    };

    utterance.onend = () => {
      stopHighlightTicker();
      isWebSpeechPlayingRef.current = false;
      (window as any).__talknative_utterance = null;
      setPlaybackState(PlaybackState.IDLE);
      setCurrentWordIndex(-1);
      activeWordIdxRef.current = -1;
      setTimeout(() => onEnd?.(), 60);
    };

    utterance.onerror = () => {
      stopHighlightTicker();
      isWebSpeechPlayingRef.current = false;
      (window as any).__talknative_utterance = null;
      setPlaybackState(PlaybackState.IDLE);
      setCurrentWordIndex(-1);
      activeWordIdxRef.current = -1;
    };

    isWebSpeechPlayingRef.current = true;
    setPlaybackState(PlaybackState.PLAYING);
    startCtxTimeRef.current = Date.now() / 1000;
    startHighlightTicker(true);
    window.speechSynthesis.speak(utterance);
  }, [voices, stopHighlightTicker, startHighlightTicker]);

  // 预加载队列
  const prefetchLines = useCallback(async (lines: DialogueLine[], startIndex: number) => {
    const nextLines = lines.slice(startIndex, startIndex + 3);
    for (const line of nextLines) {
      const cleanedText = cleanText(line.english);
      const cacheKey = `${line.speaker}:${playbackRate}:${cleanedText}`;
      if (!ttsCache.has(cacheKey) && !prefetchQueue.has(cacheKey)) {
        prefetchQueue.add(cacheKey);
        fetchTTS(cleanedText, line.speaker, playbackRate).catch(() => {}).finally(() => {
          prefetchQueue.delete(cacheKey);
        });
      }
    }
  }, [playbackRate]);

  const speak = useCallback(async (line: DialogueLine, onEnd?: () => void) => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    stop();
    const myId = ++requestIdRef.current;
    onEndRef.current = onEnd ?? null;
    setActiveLineId(line.id);
    
    const cleanedText = cleanText(line.english);
    const cacheKey = `${line.speaker}:${playbackRate}:${cleanedText}`;
    
    if (!ttsCache.has(cacheKey)) {
      setPlaybackState(PlaybackState.LOADING);
    }

    try {
      const { audio, words } = await fetchTTS(cleanedText, line.speaker, playbackRate);
      
      if (myId !== requestIdRef.current) return;

      if (ctx.state === 'suspended') await ctx.resume();

      const arrayBuffer = base64ToArrayBuffer(audio);
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      if (myId !== requestIdRef.current) return;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1.6, ctx.currentTime);
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      activeSource = source;
      sourceRef.current = source;
      pauseOffsetRef.current = 0;
      startCtxTimeRef.current = ctx.currentTime;

      // 核心高亮：若后端未返回精准 words，以实际音频时长进行科学加权切分
      const actualDuration = audioBuffer.duration;
      const validTimings = (words && words.length > 0) ? words : generateWordTimings(cleanedText, actualDuration);
      currentTimingsRef.current = validTimings;

      source.onended = () => {
        if (sourceRef.current !== source) return;
        stopHighlightTicker();
        activeSource = null;
        sourceRef.current = null;
        setPlaybackState(PlaybackState.IDLE);
        setCurrentWordIndex(-1);
        activeWordIdxRef.current = -1;
        setTimeout(() => onEndRef.current?.(), 50);
      };

      source.start(0);
      setPlaybackState(PlaybackState.PLAYING);
      // 开启防抖动的实时时钟高亮追踪
      startHighlightTicker(false);

    } catch (err) {
      console.warn('[useTTS] 后端音频异常或网络超时，平滑启用前端 WebSpeech 引擎:', err);
      if (myId !== requestIdRef.current) return;
      speakWithWebSpeech(cleanedText, line.speaker, playbackRate, onEnd);
    }
  }, [stop, stopHighlightTicker, startHighlightTicker, playbackRate, speakWithWebSpeech]);

  const pause = useCallback(() => {
    if (isWebSpeechPlayingRef.current && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
      stopHighlightTicker();
      setPlaybackState(PlaybackState.PAUSED);
      return;
    }

    if (playbackState !== PlaybackState.PLAYING) return;
    stopHighlightTicker();
    const ctx = getAudioContext();
    const elapsed = ctx.currentTime - startCtxTimeRef.current;
    pauseOffsetRef.current = elapsed; 
    ctx.suspend();
    setPlaybackState(PlaybackState.PAUSED);
  }, [playbackState, stopHighlightTicker]);

  const resume = useCallback(async (line: DialogueLine) => {
    if (isWebSpeechPlayingRef.current && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
      setPlaybackState(PlaybackState.PLAYING);
      startHighlightTicker(true);
      return;
    }

    if (playbackState === PlaybackState.PAUSED) {
      const ctx = getAudioContext();
      await ctx.resume();
      startCtxTimeRef.current = ctx.currentTime;
      startHighlightTicker(false);
      setPlaybackState(PlaybackState.PLAYING);
    } else {
      speak(line, onEndRef.current ?? undefined);
    }
  }, [playbackState, startHighlightTicker, speak]);

  return {
    playbackState,
    playbackRate,
    setPlaybackRate,
    activeLineId,
    setActiveLineId,
    currentWordIndex,
    speak,
    pause,
    resume,
    stop,
    prefetchLines
  };
}