import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/colors';

// Tempo is a single-user app with no sign-in flow — every screen reads and
// writes as the one account named by EXPO_PUBLIC_USER_ID (see lib/env.ts),
// shared identically between the iOS app and the web app.

// Tempo is a phone-first layout. On web (a desktop browser window), render it
// in a fixed phone-width column instead of stretching every screen to fill
// the browser — the same reason a mobile web app usually looks like this.
const IS_WEB = Platform.OS === 'web';
const PHONE_WIDTH = 430;

function PhoneFrame({ children }: { children: React.ReactNode }) {
  if (!IS_WEB) return <>{children}</>;
  return (
    <View style={webStyles.backdrop}>
      <View style={webStyles.frame}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <PhoneFrame>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/[id]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="workout/review/[id]" />
        <Stack.Screen name="workout/processing/[id]" />
      </Stack>
    </PhoneFrame>
  );
}

const webStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    // A slightly different shade than the app background so the phone
    // column reads as a distinct surface on a wide browser window.
    backgroundColor: '#000',
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: PHONE_WIDTH,
    boxShadow: '0 0 60px rgba(0,0,0,0.6)',
  },
});
