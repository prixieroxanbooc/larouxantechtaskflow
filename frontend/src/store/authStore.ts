import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('tf_token'),
  setAuth: (user, token) => {
    localStorage.setItem('tf_token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('tf_token');
    set({ user: null, token: null });
  },
  isAuthenticated: () => !!get().token,
}));
