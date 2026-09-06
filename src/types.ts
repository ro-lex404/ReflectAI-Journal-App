export type ReflectionMode = 'reflect' | 'summarize' | 'brainstorm';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface JournalLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  accuracy?: number;
  timestamp?: number;
}

export interface Interaction {
  id: string;
  userId: string;
  title: string;
  initialPrompt: string;
  summary?: string;
  tags: string[];
  mode: ReflectionMode;
  messages: ChatMessage[];
  location?: JournalLocation;
  draftInput?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface GeminiReflectRequest {
  reflectionText: string;
  conversationHistory?: Array<{
    role: 'user' | 'model';
    content: string;
  }>;
  mode: ReflectionMode;
}

export interface GeminiReflectResponse {
  reply: string;
  summary?: string;
  suggestedTags?: string[];
  modelUsed: string;
}
