import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { MediaAttachment } from '@/types';

interface VoiceMemoRecorderProps {
  memos: MediaAttachment[];
  onAdd: (memo: MediaAttachment) => void;
  onRemove: (id: string) => void;
  maxDuration?: number; // seconds, default 60
}

type RecordState = 'idle' | 'recording' | 'recorded';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
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

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

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
    };
  }, []);

  async function requestPermissions(): Promise<boolean> {
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
    const granted = await requestPermissions();
    if (!granted) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setRecordState('recording');
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          if (prev + 1 >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (uri) {
        const memo: MediaAttachment = {
          id: `voice-${Date.now()}`,
          type: 'voice',
          uri,
          size: 0,
          duration: elapsed,
        };
        onAdd(memo);
      }

      setRecordState('idle');
      setElapsed(0);
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setRecordState('idle');
    }
  }

  async function playMemo(memo: MediaAttachment) {
    // Stop any existing sound
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }

    if (playingId === memo.id) {
      setPlayingId(null);
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
                  <Text style={styles.memoLabel}>Voice Memo {index + 1}</Text>
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
                    if (playingId === memo.id) {
                      soundRef.current?.stopAsync().catch(() => {});
                      soundRef.current?.unloadAsync().catch(() => {});
                      soundRef.current = null;
                      setPlayingId(null);
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
          <Text style={styles.recordButtonText}>Hold to record a voice memo</Text>
        </Pressable>
      )}

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
});
