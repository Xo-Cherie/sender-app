import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

const CARD_ARRIVAL_SOUND = require('../assets/sounds/card_arrival.wav');

let audioModeReady = false;
let alertPlayer: AudioPlayer | null = null;

async function ensureDeviceAlertAudioMode() {
  if (audioModeReady || Platform.OS === 'web') return;

  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'mixWithOthers',
  });

  audioModeReady = true;
}

export async function prepareDeviceCardAlertSound() {
  if (Platform.OS === 'web') return;

  await ensureDeviceAlertAudioMode();

  if (!alertPlayer) {
    alertPlayer = createAudioPlayer(CARD_ARRIVAL_SOUND);
  }
}

export async function playDeviceCardArrivalSound() {
  if (Platform.OS === 'web') return;

  try {
    await prepareDeviceCardAlertSound();

    if (!alertPlayer) return;

    if (alertPlayer.playing) {
      await alertPlayer.pause();
    }

    await alertPlayer.seekTo(0);
    alertPlayer.play();
  } catch (error) {
    console.warn('Device card alert sound failed:', error);
  }

  if (Platform.OS === 'android') {
    Vibration.vibrate([0, 280, 160, 280]);
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}
