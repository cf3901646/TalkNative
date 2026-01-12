export interface DialogueLine {
  id: string;
  speaker: string;
  english: string;
  chinese: string;
  idioms: IdiomNote[];
}

export interface IdiomNote {
  phrase: string;
  definition: string;
  translation: string; 
  usage: string;
}

export interface VocabularyItem {
  word: string;
  ipa: string;
  translation: string;
  definition: string;
}

export interface LessonData {
  id: string;        // UUID for persistence
  createdAt: number; // Timestamp for sorting
  topic: string;
  lines: DialogueLine[];
}

export enum PlaybackState {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
}