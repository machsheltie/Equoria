import authReducer, { setUser, clearUser, setLoading } from '../authSlice';

describe('authSlice', () => {
  const initialState = {
    user: null,
    isAuthenticated: false,
    isLoading: true,
  };

  describe('initial state', () => {
    it('should return the initial state when passed undefined', () => {
      expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    it('should have isLoading as true initially', () => {
      const state = authReducer(undefined, { type: 'unknown' });
      expect(state.isLoading).toBe(true);
    });
  });

  describe('setUser', () => {
    it('should set user and mark as authenticated', () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const actual = authReducer(initialState, setUser(user));

      expect(actual.user).toEqual(user);
      expect(actual.isAuthenticated).toBe(true);
      expect(actual.isLoading).toBe(false);
    });

    it('should replace existing user', () => {
      const oldUser = {
        id: '1',
        email: 'old@example.com',
        firstName: 'Old',
        lastName: 'User',
      };

      const newUser = {
        id: '2',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
      };

      const stateWithOldUser = authReducer(initialState, setUser(oldUser));
      const actual = authReducer(stateWithOldUser, setUser(newUser));

      expect(actual.user).toEqual(newUser);
      expect(actual.user).not.toEqual(oldUser);
    });

    it('should maintain immutability', () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const stateBefore = { ...initialState };
      authReducer(initialState, setUser(user));

      expect(initialState).toEqual(stateBefore);
    });
  });

  describe('clearUser', () => {
    it('should clear user and mark as not authenticated', () => {
      const stateWithUser = {
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        isAuthenticated: true,
        isLoading: false,
      };

      const actual = authReducer(stateWithUser, clearUser());

      expect(actual.user).toBeNull();
      expect(actual.isAuthenticated).toBe(false);
      expect(actual.isLoading).toBe(false);
    });

    it('should work even if no user is set', () => {
      const actual = authReducer(initialState, clearUser());

      expect(actual.user).toBeNull();
      expect(actual.isAuthenticated).toBe(false);
    });

    it('should reset to logged out state', () => {
      const stateWithUser = {
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        isAuthenticated: true,
        isLoading: false,
      };

      const actual = authReducer(stateWithUser, clearUser());

      expect(actual).toEqual({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    });
  });

  describe('setLoading', () => {
    it('should set loading to true', () => {
      const stateNotLoading = { ...initialState, isLoading: false };
      const actual = authReducer(stateNotLoading, setLoading(true));

      expect(actual.isLoading).toBe(true);
    });

    it('should set loading to false', () => {
      const actual = authReducer(initialState, setLoading(false));

      expect(actual.isLoading).toBe(false);
    });

    it('should not affect other state properties', () => {
      const stateWithUser = {
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        isAuthenticated: true,
        isLoading: false,
      };

      const actual = authReducer(stateWithUser, setLoading(true));

      expect(actual.user).toEqual(stateWithUser.user);
      expect(actual.isAuthenticated).toBe(true);
      expect(actual.isLoading).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple state updates correctly', () => {
      let state = initialState;

      // Set user
      const user = {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };
      state = authReducer(state, setUser(user));
      expect(state.isAuthenticated).toBe(true);

      // Set loading
      state = authReducer(state, setLoading(true));
      expect(state.isLoading).toBe(true);
      expect(state.isAuthenticated).toBe(true);

      // Clear user
      state = authReducer(state, clearUser());
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should handle empty user object properties gracefully', () => {
      const user = {
        id: '',
        email: '',
        firstName: '',
        lastName: '',
      };

      const actual = authReducer(initialState, setUser(user));

      expect(actual.user).toEqual(user);
      expect(actual.isAuthenticated).toBe(true);
    });
  });
});
