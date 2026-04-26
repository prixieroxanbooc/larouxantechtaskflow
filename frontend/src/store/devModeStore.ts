import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DevModeState {
  enabled: boolean;
  toggle: () => void;
}

export const useDevMode = create<DevModeState>()(
  persist(
    (set, get) => ({
      enabled: false,
      toggle: () => set({ enabled: !get().enabled }),
    }),
    { name: 'tf-dev-mode' }
  )
);
