import { useState, useRef, useCallback } from 'react';
import { generateTopicSuggestions } from '../services/geminiService';

export function useTopics() {
  const [topic, setTopic] = useState<string>('');
  const [topicQueue, setTopicQueue] = useState<string[]>([]);
  const [seenTopics, setSeenTopics] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('talknative_seen_topics') || '[]');
    } catch { return []; }
  });
  const [isRandomizing, setIsRandomizing] = useState(false);
  const fetchingRef = useRef(false);

  const triggerFetch = useCallback(async (avoid: string[]) => {
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
        setTopic(prev => prev || newTopics[0]);
      }
    } catch (e) {
      console.warn("Background topic fetch failed", e);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const handleRandomTopic = useCallback(async () => {
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
      const newSeen = [...seenTopics, nextTopic].slice(-50);
      setSeenTopics(newSeen);
      localStorage.setItem('talknative_seen_topics', JSON.stringify(newSeen));
    }
  }, [isRandomizing, topicQueue, seenTopics, triggerFetch]);

  return {
    topic,
    setTopic,
    isRandomizing,
    handleRandomTopic
  };
}
