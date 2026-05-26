import { LessonData, IdiomNote } from '../types';

const DB_NAME = 'TalkNativeDB';
const DB_VERSION = 1;
const LESSONS_STORE = 'lessons';
const FAVORITES_STORE = 'favorites';

export class DB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(LESSONS_STORE)) {
          db.createObjectStore(LESSONS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
          db.createObjectStore(FAVORITES_STORE, { keyPath: 'phrase' });
        }
      };
      request.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllLessons(): Promise<LessonData[]> {
    return this.getAll<LessonData>(LESSONS_STORE);
  }

  async saveLesson(lesson: LessonData): Promise<void> {
    return this.put(LESSONS_STORE, lesson);
  }

  async deleteLesson(id: string): Promise<void> {
    return this.delete(LESSONS_STORE, id);
  }

  async getAllFavorites(): Promise<IdiomNote[]> {
    return this.getAll<IdiomNote>(FAVORITES_STORE);
  }

  async toggleFavorite(idiom: IdiomNote): Promise<void> {
    const favorites = await this.getAllFavorites();
    const exists = favorites.find(f => f.phrase === idiom.phrase);
    if (exists) {
      return this.delete(FAVORITES_STORE, idiom.phrase);
    } else {
      return this.put(FAVORITES_STORE, idiom);
    }
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async put(storeName: string, data: any): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async delete(storeName: string, key: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const db = new DB();
