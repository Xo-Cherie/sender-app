const IS_DEVICE_VARIANT = process.env.EXPO_PUBLIC_APP_VARIANT === 'device';
const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '22406cb6-5917-4bb4-a86f-123e5913ef1a';

module.exports = {
  expo: {
    name: IS_DEVICE_VARIANT ? 'Cherie Device' : 'Xo Cherie',
    slug: 'xocherie',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/logo.png',
    scheme: IS_DEVICE_VARIANT ? 'cheriedevice' : 'xocherie',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEVICE_VARIANT
        ? 'com.xocherie.device'
        : 'com.xocherie.app',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ['remote-notification'],
        NSMicrophoneUsageDescription:
          'Xo Cherie uses the microphone so you can record voice memos for greeting cards.',
        NSPhotoLibraryUsageDescription:
          'Xo Cherie needs photo library access so you can choose images for cards and your profile.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/logo.png',
        backgroundColor: '#FFF7F4',
      },
      edgeToEdgeEnabled: true,
      permissions: [
        'READ_EXTERNAL_STORAGE',
        'READ_MEDIA_IMAGES',
        'POST_NOTIFICATIONS',
        'RECORD_AUDIO',
      ],
      package: IS_DEVICE_VARIANT
        ? 'com.xocherie.device'
        : 'com.xocherie.app',
      intentFilters: [
        {
          action: 'VIEW',
          data: [{ scheme: IS_DEVICE_VARIANT ? 'cheriedevice' : 'xocherie' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/logo.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/logo.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/notification-icon.png',
          color: '#C17B66',
          defaultChannel: 'default',
          sounds: ['./assets/sounds/card_arrival.wav'],
        },
      ],
      '@react-native-community/datetimepicker',
      'expo-font',
      'expo-localization',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appVariant: IS_DEVICE_VARIANT ? 'device' : 'main',
      router: {},
      ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
    },
  },
};
