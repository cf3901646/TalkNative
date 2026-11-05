/**
 * useTTS — 工业级双轨自适应语音合成与高亮引擎
 * 1. 优先尝试高精度 edge-tts 后端 (/api/tts)
 * 2. 在纯静态托管 (如 Cloudflare Pages 报 405/404) 或断网时，零感知平滑降级至浏览器原生 Web Speech API
 * 3. 完美区分 Alex (男声) 与 Jordan (女声)，精准支持逐词荧光笔高亮同步与语速自适应调节
 */

import { useState, useRef, useCallback } from 'react';
import { PlaybackState, DialogueLine } from '../types';

interface WordTiming {
  word: string;
  start: number;
  duration: number;
}

interface TTSResponse {
  audio: string;
  words: WordTiming[];
}

let audioCtx: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;

const getAudioContext = () => {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  return audioCtx;
};

const ttsCache = new Map<string, TTSResponse>();
const prefetchQueue = new Set<string>();

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
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startCtxTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const currentTimingsRef = useRef<WordTiming[]>([]);
  const onEndRef = useRef<(() => void) | null>(null);
  const isWebSpeechPlayingRef = useRef<boolean>(false);

  const clearHighlightTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const stop = useCallback(() => {
    clearHighlightTimers();
    
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

    setPlaybackState(PlaybackState.IDLE);
    setCurrentWordIndex(-1);
    pauseOffsetRef.current = 0;
  }, [clearHighlightTimers]);

  const scheduleHighlights = useCallback((
    timings: WordTiming[],
    offsetSeconds: number
  ) => {
    clearHighlightTimers();
    timings.forEach((t, wordIdx) => {
      const delay = (t.start - offsetSeconds) * 1000;
      if (delay < 0) return;

      const id = setTimeout(() => {
        setCurrentWordIndex(wordIdx);
      }, delay);
      timersRef.current.push(id);
    });
  }, [clearHighlightTimers]);

  // 纯前端原生高保真发音引擎（平滑降级兜底）
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
    utterance.lang = 'en-US';
    utterance.rate = Math.max(0.6, Math.min(1.8, rate));

    // 智能选取匹配发音人（Alex 男声，Jordan 女声）
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

    // 建立词汇索引表用于 onboundary 高精度对齐
    const words = text.trim().split(/\s+/);
    const wordOffsets: number[] = [];
    let curOffset = 0;
    for (const w of words) {
      const idx = text.indexOf(w, curOffset);
      wordOffsets.push(idx !== -1 ? idx : curOffset);
      curOffset = (idx !== -1 ? idx : curOffset) + w.length;
    }

    utterance.onboundary = (e) => {
      if (e.name === 'word' || typeof e.charIndex === 'number') {
        const charIdx = e.charIndex;
        let matchedIdx = 0;
        for (let i = 0; i < wordOffsets.length; i++) {
          if (charIdx >= wordOffsets[i]) {
            matchedIdx = i;
          } else {
            break;
          }
        }
        setCurrentWordIndex(matchedIdx);
      }
    };

    utterance.onstart = () => {
      isWebSpeechPlayingRef.current = true;
      setPlaybackState(PlaybackState.PLAYING);
      setCurrentWordIndex(0);
    };

    utterance.onend = () => {
      isWebSpeechPlayingRef.current = false;
      setPlaybackState(PlaybackState.IDLE);
      setCurrentWordIndex(-1);
      setTimeout(() => onEnd?.(), 60);
    };

    utterance.onerror = (e) => {
      console.warn('[WebSpeech] 发音事件被中止或遇到异常:', e);
      isWebSpeechPlayingRef.current = false;
      setPlaybackState(PlaybackState.IDLE);
      setCurrentWordIndex(-1);
    };

    isWebSpeechPlayingRef.current = true;
    setPlaybackState(PlaybackState.PLAYING);
    window.speechSynthesis.speak(utterance);
  }, [voices]);

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

      currentTimingsRef.current = words;

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

      source.onended = () => {
        if (sourceRef.current !== source) return;
        clearHighlightTimers();
        activeSource = null;
        sourceRef.current = null;
        setPlaybackState(PlaybackState.IDLE);
        setCurrentWordIndex(-1);
        setTimeout(() => onEndRef.current?.(), 50);
      };

      source.start(0);
      setPlaybackState(PlaybackState.PLAYING);
      scheduleHighlights(words, 0);

    } catch (err) {
      console.warn('[useTTS] 后端音频服务不可用(静态托管或405)，已无缝平滑切换至浏览器原生高保真发音:', err);
      if (myId !== requestIdRef.current) return;
      speakWithWebSpeech(cleanedText, line.speaker, playbackRate, onEnd);
    }
  }, [stop, clearHighlightTimers, scheduleHighlights, playbackRate, speakWithWebSpeech]);

  const pause = useCallback(() => {
    if (isWebSpeechPlayingRef.current && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
      setPlaybackState(PlaybackState.PAUSED);
      return;
    }

    if (playbackState !== PlaybackState.PLAYING) return;
    clearHighlightTimers();
    const ctx = getAudioContext();
    const elapsed = ctx.currentTime - startCtxTimeRef.current;
    pauseOffsetRef.current = elapsed; 
    ctx.suspend();
    setPlaybackState(PlaybackState.PAUSED);
  }, [playbackState, clearHighlightTimers]);

  const resume = useCallback(async (line: DialogueLine) => {
    if (isWebSpeechPlayingRef.current && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
      setPlaybackState(PlaybackState.PLAYING);
      return;
    }

    if (playbackState === PlaybackState.PAUSED) {
      const ctx = getAudioContext();
      await ctx.resume();
      startCtxTimeRef.current = ctx.currentTime;
      scheduleHighlights(
        currentTimingsRef.current,
        pauseOffsetRef.current
      );
      setPlaybackState(PlaybackState.PLAYING);
    } else {
      speak(line, onEndRef.current ?? undefined);
    }
  }, [playbackState, scheduleHighlights, speak]);

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
