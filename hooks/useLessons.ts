import { useState, useEffect, useCallback } from 'react';
import { LessonData, IdiomNote } from '../types';
import { db } from '../utils/db';

export function useLessons() {
  const [savedLessons, setSavedLessons] = useState<LessonData[]>([]);
  const [favorites, setFavorites] = useState<IdiomNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const lessons = await db.getAllLessons();
      const favs = await db.getAllFavorites();
      setSavedLessons(lessons.sort((a, b) => b.createdAt - a.createdAt));
      setFavorites(favs);
    } catch (e) {
      console.error("Failed to load lessons from DB", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveLesson = useCallback(async (lesson: LessonData) => {
    await db.saveLesson(lesson);
    setSavedLessons(prev => {
      const exists = prev.find(l => l.id === lesson.id);
      if (exists) return prev;
      return [lesson, ...prev].slice(0, 50); // Keep last 50
    });
  }, []);

  const deleteLesson = useCallback(async (id: string) => {
    await db.deleteLesson(id);
    setSavedLessons(prev => prev.filter(l => l.id !== id));
  }, []);

  const toggleFavorite = useCallback(async (idiom: IdiomNote) => {
    await db.toggleFavorite(idiom);
    const favs = await db.getAllFavorites();
    setFavorites(favs);
  }, []);

  return {
    savedLessons,
    favorites,
    isLoading,
    saveLesson,
    deleteLesson,
    toggleFavorite
  };
}
