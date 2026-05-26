/**
 * useTTS — 优化版：支持后端语速控制与音频预加载
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
let activeSource: AudioBufferSourceNode | null = null; // 全局活动音频源，防止多实例或快速点击导致双声道重叠

const getAudioContext = () => {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  return audioCtx;
};

// 缓存与预加载队列
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

const cleanText = (text: string): string =>
  text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/<\/?[biBIstrongSTRONG]+>/g, '');

export function useTTS(_voices: SpeechSynthesisVoice[]) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.IDLE);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);

  // 唯一请求 ID，防止连续点击导致的重叠播放
  const requestIdRef = useRef<number>(0);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startCtxTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const currentTimingsRef = useRef<WordTiming[]>([]);
  const onEndRef = useRef<(() => void) | null>(null);

  const clearHighlightTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const stop = useCallback(() => {
    clearHighlightTimers();
    
    // 优先停止全局唯一活动音频源，彻底杜绝双声道重叠
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
      // 后端已处理语速，所以 start 时间是绝对正确的
      const delay = (t.start - offsetSeconds) * 1000;
      if (delay < 0) return;

      const id = setTimeout(() => {
        setCurrentWordIndex(wordIdx);
      }, delay);
      timersRef.current.push(id);
    });
  }, [clearHighlightTimers]);

  // 预加载函数
  const prefetchLines = useCallback(async (lines: DialogueLine[], startIndex: number) => {
    // 预加载接下来的 2 句
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
    // 1. 同步获取并激活 AudioContext 实例，借由当前的用户交互手势瞬间获取浏览器授权
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
      
      // 关键检查：如果在我下载期间用户点了别的句子，我应该静默退出
      if (myId !== requestIdRef.current) return;

      currentTimingsRef.current = words;

      if (ctx.state === 'suspended') await ctx.resume();

      const arrayBuffer = base64ToArrayBuffer(audio);
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // 再次检查，防止解码期间发生切换
      if (myId !== requestIdRef.current) return;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      
      // 方案一：引入 1.6 倍无损硬件级增益放大器，解决声音轻的痛点
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1.6, ctx.currentTime);
      
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      activeSource = source; // 标记为全局唯一活动音频源
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
        // 缩短切换延迟，让播放更紧凑
        setTimeout(() => onEndRef.current?.(), 50);
      };

      source.start(0);
      setPlaybackState(PlaybackState.PLAYING);
      scheduleHighlights(words, 0);

    } catch (err) {
      console.error('[TTS] 失败:', err);
      setPlaybackState(PlaybackState.IDLE);
      onEnd?.();
    }
  }, [stop, clearHighlightTimers, scheduleHighlights, playbackRate]);

  const pause = useCallback(() => {
    if (playbackState !== PlaybackState.PLAYING) return;
    clearHighlightTimers();
    const ctx = getAudioContext();
    const elapsed = ctx.currentTime - startCtxTimeRef.current;
    pauseOffsetRef.current = elapsed; 
    ctx.suspend();
    setPlaybackState(PlaybackState.PAUSED);
  }, [playbackState, clearHighlightTimers]);

  const resume = useCallback(async (line: DialogueLine) => {
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
    prefetchLines // 暴露预加载方法
  };
}
