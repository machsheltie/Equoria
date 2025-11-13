import appReducer, {
  setTheme,
  setLanguage,
  toggleNotifications,
  toggleSound,
  AppState,
} from '../appSlice';

describe('appSlice', () => {
  const initialState = {
    theme: 'system' as const,
    language: 'en' as const,
    notificationsEnabled: true,
    soundEnabled: true,
  };

  describe('initial state', () => {
    it('should return the initial state when passed undefined', () => {
      expect(appReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    it('should have correct default values', () => {
      const state = appReducer(undefined, { type: 'unknown' });

      expect(state.theme).toBe('system');
      expect(state.language).toBe('en');
      expect(state.notificationsEnabled).toBe(true);
      expect(state.soundEnabled).toBe(true);
    });
  });

  describe('setTheme', () => {
    it('should set theme to light', () => {
      const actual = appReducer(initialState, setTheme('light'));
      expect(actual.theme).toBe('light');
    });

    it('should set theme to dark', () => {
      const actual = appReducer(initialState, setTheme('dark'));
      expect(actual.theme).toBe('dark');
    });

    it('should set theme to system', () => {
      const stateWithLightTheme = { ...initialState, theme: 'light' as const };
      const actual = appReducer(stateWithLightTheme, setTheme('system'));
      expect(actual.theme).toBe('system');
    });

    it('should not affect other state properties', () => {
      const actual = appReducer(initialState, setTheme('dark'));

      expect(actual.language).toBe('en');
      expect(actual.notificationsEnabled).toBe(true);
      expect(actual.soundEnabled).toBe(true);
    });

    it('should maintain immutability', () => {
      const stateBefore = { ...initialState };
      appReducer(initialState, setTheme('dark'));

      expect(initialState).toEqual(stateBefore);
    });
  });

  describe('setLanguage', () => {
    it('should set language to English', () => {
      const actual = appReducer(initialState, setLanguage('en'));
      expect(actual.language).toBe('en');
    });

    it('should set language to Spanish', () => {
      const actual = appReducer(initialState, setLanguage('es'));
      expect(actual.language).toBe('es');
    });

    it('should set language to French', () => {
      const actual = appReducer(initialState, setLanguage('fr'));
      expect(actual.language).toBe('fr');
    });

    it('should change from one language to another', () => {
      let state: AppState = appReducer(initialState, setLanguage('es'));
      expect(state.language).toBe('es');

      state = appReducer(state, setLanguage('fr'));
      expect(state.language).toBe('fr');
    });

    it('should not affect other state properties', () => {
      const actual = appReducer(initialState, setLanguage('es'));

      expect(actual.theme).toBe('system');
      expect(actual.notificationsEnabled).toBe(true);
      expect(actual.soundEnabled).toBe(true);
    });
  });

  describe('toggleNotifications', () => {
    it('should toggle notifications from true to false', () => {
      const actual = appReducer(initialState, toggleNotifications());
      expect(actual.notificationsEnabled).toBe(false);
    });

    it('should toggle notifications from false to true', () => {
      const stateWithNotificationsOff = { ...initialState, notificationsEnabled: false };
      const actual = appReducer(stateWithNotificationsOff, toggleNotifications());
      expect(actual.notificationsEnabled).toBe(true);
    });

    it('should toggle multiple times correctly', () => {
      let state: AppState = initialState;

      state = appReducer(state, toggleNotifications());
      expect(state.notificationsEnabled).toBe(false);

      state = appReducer(state, toggleNotifications());
      expect(state.notificationsEnabled).toBe(true);

      state = appReducer(state, toggleNotifications());
      expect(state.notificationsEnabled).toBe(false);
    });

    it('should not affect other state properties', () => {
      const actual = appReducer(initialState, toggleNotifications());

      expect(actual.theme).toBe('system');
      expect(actual.language).toBe('en');
      expect(actual.soundEnabled).toBe(true);
    });
  });

  describe('toggleSound', () => {
    it('should toggle sound from true to false', () => {
      const actual = appReducer(initialState, toggleSound());
      expect(actual.soundEnabled).toBe(false);
    });

    it('should toggle sound from false to true', () => {
      const stateWithSoundOff = { ...initialState, soundEnabled: false };
      const actual = appReducer(stateWithSoundOff, toggleSound());
      expect(actual.soundEnabled).toBe(true);
    });

    it('should toggle multiple times correctly', () => {
      let state: AppState = initialState;

      state = appReducer(state, toggleSound());
      expect(state.soundEnabled).toBe(false);

      state = appReducer(state, toggleSound());
      expect(state.soundEnabled).toBe(true);

      state = appReducer(state, toggleSound());
      expect(state.soundEnabled).toBe(false);
    });

    it('should not affect other state properties', () => {
      const actual = appReducer(initialState, toggleSound());

      expect(actual.theme).toBe('system');
      expect(actual.language).toBe('en');
      expect(actual.notificationsEnabled).toBe(true);
    });
  });

  describe('multiple actions', () => {
    it('should handle multiple state updates correctly', () => {
      let state: AppState = initialState;

      state = appReducer(state, setTheme('dark'));
      expect(state.theme).toBe('dark');

      state = appReducer(state, setLanguage('es'));
      expect(state.language).toBe('es');
      expect(state.theme).toBe('dark'); // Should still be dark

      state = appReducer(state, toggleNotifications());
      expect(state.notificationsEnabled).toBe(false);
      expect(state.theme).toBe('dark');
      expect(state.language).toBe('es');

      state = appReducer(state, toggleSound());
      expect(state.soundEnabled).toBe(false);
      expect(state.theme).toBe('dark');
      expect(state.language).toBe('es');
      expect(state.notificationsEnabled).toBe(false);
    });

    it('should maintain state consistency across different action sequences', () => {
      let state: AppState = initialState;

      // Change all settings
      state = appReducer(state, setTheme('light'));
      state = appReducer(state, setLanguage('fr'));
      state = appReducer(state, toggleNotifications());
      state = appReducer(state, toggleSound());

      expect(state).toEqual({
        theme: 'light',
        language: 'fr',
        notificationsEnabled: false,
        soundEnabled: false,
      });

      // Change back
      state = appReducer(state, setTheme('system'));
      state = appReducer(state, setLanguage('en'));
      state = appReducer(state, toggleNotifications());
      state = appReducer(state, toggleSound());

      expect(state).toEqual(initialState);
    });
  });

  describe('edge cases', () => {
    it('should handle setting the same theme multiple times', () => {
      let state: AppState = appReducer(initialState, setTheme('dark'));
      state = appReducer(state, setTheme('dark'));
      state = appReducer(state, setTheme('dark'));

      expect(state.theme).toBe('dark');
    });

    it('should handle setting the same language multiple times', () => {
      let state: AppState = appReducer(initialState, setLanguage('es'));
      state = appReducer(state, setLanguage('es'));
      state = appReducer(state, setLanguage('es'));

      expect(state.language).toBe('es');
    });

    it('should handle rapid toggle operations', () => {
      let state: AppState = initialState;

      for (let i = 0; i < 10; i++) {
        state = appReducer(state, toggleNotifications());
      }

      // After 10 toggles (even number), should be back to initial state
      expect(state.notificationsEnabled).toBe(true);
    });
  });
});
