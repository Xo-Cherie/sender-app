import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { MediaAttachment } from '@/types';

interface VoiceMemoRecorderProps {
  memos: MediaAttachment[];
  onAdd: (memo: MediaAttachment) => void | Promise<void>;
  onRemove: (id: string) => void;
  maxDuration?: number; // seconds, default 60
}

type RecordState = 'idle' | 'recording' | 'saving';

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getRecordedDurationSeconds(startedAt: number | null, elapsedSeconds: number): number {
  if (startedAt) {
    return Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  }
  return Math.max(1, elapsedSeconds || 1);
}

export function VoiceMemoRecorder({
  memos,
  onAdd,
  onRemove,
  maxDuration = 60,
}: VoiceMemoRecorderProps) {
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playPosition, setPlayPosition] = useState<Record<string, number>>({});
  const [webError, setWebError] = useState('');

  const recordingRef = useRef<Audio.Recording | null>(null);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const elapsedRef = useRef(0);
  const recordingStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current = null;
      }
      if (webRecorderRef.current?.state === 'recording') {
        webRecorderRef.current.stop();
      }
      webStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  async function requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return true;

    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Microphone Permission',
        'Please allow microphone access to record voice memos.'
      );
      return false;
    }
    return true;
  }

  async function startRecording() {
    setWebError('');
    const granted = await requestPermissions();
    if (!granted) return;

    try {
      if (Platform.OS === 'web') {
        await startWebRecording();
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      beginRecordingTimer();
    } catch (err) {
      console.error('Failed to start recording:', err);
      showError('Could not start recording. Please check microphone permissions and try again.');
    }
  }

  async function stopRecording() {
    if (Platform.OS === 'web') {
      await stopWebRecording();
      return;
    }

    if (!recordingRef.current) return;

    clearRecordingTimer();
    setRecordState('saving');

    try {
      const recording = recordingRef.current;
      const status = await recording.stopAndUnloadAsync();
      const uri = recording.getURI() || status?.uri || null;
      recordingRef.current = null;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (uri) {
        const duration = getRecordedDurationSeconds(
          recordingStartedAtRef.current,
          elapsedRef.current
        );
        const memo: MediaAttachment = {
          id: `voice-${Date.now()}`,
          type: 'voice',
          uri,
          size: 0,
          duration,
          mimeType: 'audio/m4a',
          pendingUpload: true,
        };
        await addMemo(memo);
      } else {
        showError('No audio was captured. Please try recording again.');
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      showError('Could not save this recording. Please try again.');
    } finally {
      recordingStartedAtRef.current = null;
      setRecordState('idle');
      setElapsed(0);
      elapsedRef.current = 0;
    }
  }

  function beginRecordingTimer() {
    setRecordState('recording');
    setElapsed(0);
    elapsedRef.current = 0;
    recordingStartedAtRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = Math.min(prev + 1, maxDuration);
        elapsedRef.current = next;

        if (next >= maxDuration) {
          void stopRecording();
        }

        return next;
      });
    }, 1000);
  }

  function clearRecordingTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startWebRecording() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showError(
        'Voice recording needs microphone access from a secure page. Open the app on https:// or http://localhost, not a LAN/http URL.'
      );
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      showError('Voice recording is not supported in this browser. Please try Chrome, Edge, or Safari.');
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      showError(
        'Microphone recording is blocked because this page is not secure. Use https:// or http://localhost to record voice memos.'
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error: any) {
      const message = error?.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow microphone access in the browser, then try again.'
        : 'Could not access the microphone. Please check your browser microphone settings.';
      showError(message);
      return;
    }

    const mimeType = getSupportedWebAudioMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    webChunksRef.current = [];
    webStreamRef.current = stream;
    webRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        webChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      clearRecordingTimer();
      const blobType = normalizeWebMimeType(recorder.mimeType || mimeType || 'audio/webm');
      const blob = new Blob(webChunksRef.current, { type: blobType });

      if (blob.size === 0) {
        showError('No audio was recorded. Please try again and speak after the timer starts.');
        cleanupWebRecording();
        webRecorderRef.current = null;
        webChunksRef.current = [];
        recordingStartedAtRef.current = null;
        setRecordState('idle');
        setElapsed(0);
        elapsedRef.current = 0;
        return;
      }

      const uri = URL.createObjectURL(blob);
      const duration = getRecordedDurationSeconds(
        recordingStartedAtRef.current,
        elapsedRef.current
      );

      const memo: MediaAttachment = {
        id: `voice-${Date.now()}`,
        type: 'voice',
        uri,
        size: blob.size,
        duration,
        mimeType: blobType,
        pendingUpload: true,
      };

      cleanupWebRecording();
      webRecorderRef.current = null;
      webChunksRef.current = [];
      recordingStartedAtRef.current = null;
      setElapsed(0);
      elapsedRef.current = 0;
      setRecordState('saving');

      try {
        await addMemo(memo);
      } finally {
        setRecordState('idle');
      }
    };

    recorder.onerror = () => {
      showError('Recording failed in the browser. Please try again.');
      cleanupWebRecording();
      setRecordState('idle');
      setElapsed(0);
      elapsedRef.current = 0;
    };

    recorder.start(250);
    beginRecordingTimer();
  }

  function stopWebRecording() {
    if (!webRecorderRef.current || webRecorderRef.current.state !== 'recording') return;
    if (typeof webRecorderRef.current.requestData === 'function') {
      webRecorderRef.current.requestData();
    }
    webRecorderRef.current.stop();
  }

  function normalizeWebMimeType(mimeType: string): string {
    return mimeType.split(';')[0]?.trim().toLowerCase() || 'audio/webm';
  }

  function getSupportedWebAudioMimeType(): string | undefined {
    if (typeof MediaRecorder.isTypeSupported !== 'function') {
      return undefined;
    }

    const supportedTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
    ];

    return supportedTypes.find(type => MediaRecorder.isTypeSupported(type));
  }

  async function addMemo(memo: MediaAttachment) {
    try {
      await onAdd(memo);
    } catch (error) {
      console.error('Failed to save voice memo:', error);
      if (Platform.OS === 'web' && memo.uri.startsWith('blob:')) {
        URL.revokeObjectURL(memo.uri);
      }
      Alert.alert('Error', 'Could not save this voice memo.');
      throw error;
    }
  }

  function cleanupWebRecording() {
    webStreamRef.current?.getTracks().forEach(track => track.stop());
    webStreamRef.current = null;
  }

  function showError(message: string) {
    setWebError(message);
    if (Platform.OS !== 'web') {
      Alert.alert('Error', message);
    }
  }

  async function stopCurrentPlayback() {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }

    if (webAudioRef.current) {
      webAudioRef.current.pause();
      webAudioRef.current.currentTime = 0;
      webAudioRef.current = null;
    }
  }

  async function playMemo(memo: MediaAttachment) {
    await stopCurrentPlayback();

    if (playingId === memo.id) {
      setPlayingId(null);
      return;
    }

    if (Platform.OS === 'web') {
      try {
        const audio = new window.Audio(memo.uri);
        audio.preload = 'auto';
        audio.onloadedmetadata = () => {
          setPlayPosition(prev => ({
            ...prev,
            [memo.id]: 0,
          }));
        };
        audio.ontimeupdate = () => {
          const pos = Number.isFinite(audio.currentTime)
            ? Math.round(audio.currentTime)
            : 0;
          setPlayPosition(prev => ({ ...prev, [memo.id]: pos }));
        };
        audio.onended = () => {
          setPlayingId(null);
          webAudioRef.current = null;
          setPlayPosition(prev => ({ ...prev, [memo.id]: 0 }));
        };
        audio.onerror = () => {
          setPlayingId(null);
          webAudioRef.current = null;
          showError('Could not play this voice memo.');
        };

        webAudioRef.current = audio;
        setPlayingId(memo.id);
        await audio.play();
      } catch (err) {
        console.error('Failed to play memo:', err);
        setPlayingId(null);
        webAudioRef.current = null;
        showError('Could not play this voice memo.');
      }
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: memo.uri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              setPlayingId(null);
              setPlayPosition(prev => ({ ...prev, [memo.id]: 0 }));
            } else {
              const pos = status.positionMillis
                ? Math.round(status.positionMillis / 1000)
                : 0;
              setPlayPosition(prev => ({ ...prev, [memo.id]: pos }));
            }
          }
        }
      );
      soundRef.current = sound;
      setPlayingId(memo.id);
    } catch (err) {
      console.error('Failed to play memo:', err);
      Alert.alert('Error', 'Could not play this voice memo.');
    }
  }

  const voiceMemos = memos.filter(m => m.type === 'voice');

  return (
    <View style={styles.container}>
      {/* Recorded memos list */}
      {voiceMemos.length > 0 && (
        <View style={styles.memoList}>
          {voiceMemos.map((memo, index) => {
            const isPlaying = playingId === memo.id;
            const pos = playPosition[memo.id] ?? 0;
            const dur = memo.duration ?? 0;
            const progress = dur > 0 ? (isPlaying ? pos / dur : 0) : 0;

            return (
              <View key={memo.id} style={styles.memoRow}>
                <Pressable
                  style={[styles.playBtn, isPlaying && styles.playBtnActive]}
                  onPress={() => playMemo(memo)}
                >
                  <MaterialIcons
                    name={isPlaying ? 'pause' : 'play-arrow'}
                    size={22}
                    color={isPlaying ? theme.colors.white : theme.colors.primary}
                  />
                </Pressable>

                <View style={styles.memoInfo}>
                  <Text style={styles.memoLabel}>
                    Voice Memo {index + 1}
                    {memo.pendingUpload ? ' · Saving…' : ''}
                  </Text>
                  <View style={styles.waveBarRow}>
                    {/* Waveform bars (decorative) */}
                    {Array.from({ length: 20 }).map((_, i) => {
                      const barH = 4 + Math.sin(i * 0.8) * 4 + Math.sin(i * 2.1) * 3;
                      const filled = progress > 0 && i / 20 <= progress;
                      return (
                        <View
                          key={i}
                          style={[
                            styles.waveBar,
                            { height: Math.max(4, barH) },
                            filled && styles.waveBarFilled,
                          ]}
                        />
                      );
                    })}
                  </View>
                  <Text style={styles.memoDuration}>
                    {isPlaying
                      ? `${formatTime(pos)} / ${formatTime(dur)}`
                      : formatTime(dur)}
                  </Text>
                </View>

                <Pressable
                  style={styles.removeBtn}
                  onPress={() => {
                    void stopCurrentPlayback();
                    if (Platform.OS === 'web' && memo.uri.startsWith('blob:')) {
                      URL.revokeObjectURL(memo.uri);
                    }
                    onRemove(memo.id);
                  }}
                >
                  <MaterialIcons name="delete-outline" size={20} color={theme.colors.error} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* Record button */}
      {recordState === 'idle' && voiceMemos.length < 3 && (
        <Pressable style={styles.recordButton} onPress={startRecording}>
          <View style={styles.recordDot} />
          <Text style={styles.recordButtonText}>Tap to record a voice memo</Text>
        </Pressable>
      )}

      {recordState === 'saving' && (
        <View style={styles.savingBox}>
          <Text style={styles.savingText}>Saving voice memo…</Text>
        </View>
      )}

      {webError ? (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={16} color={theme.colors.error} />
          <Text style={styles.errorText}>{webError}</Text>
        </View>
      ) : null}

      {recordState === 'recording' && (
        <View style={styles.recordingActive}>
          <View style={styles.recordingPulse}>
            <View style={styles.recordingDotLive} />
          </View>
          <View style={styles.recordingCenter}>
            <Text style={styles.recordingTimer}>{formatTime(elapsed)}</Text>
            <Text style={styles.recordingHint}>Recording... tap stop when done</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(elapsed / maxDuration) * 100}%` },
                ]}
              />
            </View>
          </View>
          <Pressable style={styles.stopButton} onPress={stopRecording}>
            <View style={styles.stopSquare} />
          </Pressable>
        </View>
      )}

      {voiceMemos.length >= 3 && recordState === 'idle' && (
        <Text style={styles.limitText}>Maximum 3 voice memos per card</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
  },
  memoList: {
    gap: theme.spacing.sm,
  },
  memoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  memoInfo: {
    flex: 1,
  },
  memoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.dark,
    marginBottom: 4,
  },
  waveBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 20,
    marginBottom: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.lightGray,
  },
  waveBarFilled: {
    backgroundColor: theme.colors.primary,
  },
  memoDuration: {
    fontSize: 11,
    color: theme.colors.mediumGray,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
    ...theme.shadows.card,
  },
  recordDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.error,
  },
  recordButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.error,
    fontWeight: '500',
  },
  recordingActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.error,
    ...theme.shadows.card,
  },
  recordingPulse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(192,80,80,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingDotLive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.error,
  },
  recordingCenter: {
    flex: 1,
  },
  recordingTimer: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.error,
    fontVariant: ['tabular-nums'],
  },
  recordingHint: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    marginTop: 1,
    marginBottom: 4,
  },
  progressBar: {
    height: 3,
    backgroundColor: theme.colors.lightGray,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.error,
    borderRadius: 2,
  },
  stopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: {
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: theme.colors.white,
  },
  limitText: {
    fontSize: 13,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  savingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    ...theme.shadows.card,
  },
  savingText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
});
