import { Platform } from 'react-native';
import * as Burnt from 'burnt';
// For web, if burnt doesn't work, we can fallback to native browser alerts or a custom web toaster
// However, the burnt package includes a web implementation using sonner!

export const toast = {
  success: (title: string, message?: string) => {
    Burnt.toast({
      title,
      message,
      preset: 'done',
      haptic: 'success',
      duration: 3,
    });
  },
  error: (title: string, message?: string) => {
    Burnt.toast({
      title,
      message,
      preset: 'error',
      haptic: 'error',
      duration: 5,
    });
  },
  info: (title: string, message?: string) => {
    Burnt.toast({
      title,
      message,
      preset: 'none',
      haptic: 'success', // A light haptic is nice
      duration: 3,
    });
  }
};
