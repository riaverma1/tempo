export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';
export const BYPASS_AUTH = USE_MOCK || process.env.EXPO_PUBLIC_BYPASS_AUTH === 'true';
