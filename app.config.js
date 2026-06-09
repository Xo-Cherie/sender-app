const IS_DEVICE_VARIANT = process.env.EXPO_PUBLIC_APP_VARIANT === 'device';

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
        ? 'com.osamakhanfree.cheriedevice'
        : 'com.osamakhanfree.xocherie',
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
        'RECORD_AUDIO',
      ],
      package: IS_DEVICE_VARIANT
        ? 'com.osamakhanfree.cheriedevice'
        : 'com.osamakhanfree.xocherie',
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
      eas: {
        projectId: '116f9b1c-fe55-4d94-814f-52b40adee1eb',
      },
    },
  },
};
