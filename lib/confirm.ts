import { Alert, Platform } from 'react-native';

// RN's Alert.alert renders nothing on react-native-web, so every confirm/
// error dialog silently no-ops there. These wrap the platform's native
// dialog on iOS/Android and fall back to window.confirm/alert on web.

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirm(
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void
) {
  if (Platform.OS === 'web') {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}
