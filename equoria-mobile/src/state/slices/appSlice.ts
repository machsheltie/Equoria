import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type Theme = 'light' | 'dark' | 'system';
export type Language = 'en' | 'es' | 'fr';

export interface AppState {
  theme: Theme;
  language: Language;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

const initialState: AppState = {
  theme: 'system',
  language: 'en',
  notificationsEnabled: true,
  soundEnabled: true,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<Language>) => {
      state.language = action.payload;
    },
    toggleNotifications: (state) => {
      state.notificationsEnabled = !state.notificationsEnabled;
    },
    toggleSound: (state) => {
      state.soundEnabled = !state.soundEnabled;
    },
  },
});

export const { setTheme, setLanguage, toggleNotifications, toggleSound } = appSlice.actions;
export default appSlice.reducer;
