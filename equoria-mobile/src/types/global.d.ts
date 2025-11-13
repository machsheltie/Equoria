// Global type declarations for React Native and Expo

declare global {
  /**
   * React Native development mode flag
   */
  var __DEV__: boolean;

  /**
   * Node.js global object (for Jest test environment)
   */
  var global: typeof globalThis & {
    __DEV__: boolean;
  };
}

export {};
