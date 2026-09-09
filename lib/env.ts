export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

// Tempo has no sign-in flow — one person, one account. Both the iOS app and
// the web app read and write as this fixed Supabase user id, so they always
// see the same data.
export const OWNER_USER_ID = process.env.EXPO_PUBLIC_USER_ID ?? '';
