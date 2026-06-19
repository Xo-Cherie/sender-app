import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import {
  DeviceNewCardAlert,
  subscribeDeviceNewCardAlerts,
} from '@/lib/deviceCardAlerts';

const AUTO_DISMISS_MS = 8000;

export function DeviceNewCardBanner() {
  const router = useRouter();
  const [alert, setAlert] = useState<DeviceNewCardAlert | null>(null);

  useEffect(() => {
    return subscribeDeviceNewCardAlerts((nextAlert) => {
      setAlert(nextAlert);
    });
  }, []);

  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => setAlert(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [alert]);

  if (!alert) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        style={styles.banner}
        onPress={() => {
          setAlert(null);
          router.push(`/device/card/${alert.cardId}` as any);
        }}
      >
        <View style={styles.iconWrap}>
          <MaterialIcons name="mail" size={22} color={theme.colors.white} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{alert.title}</Text>
          <Text style={styles.body}>{alert.body}</Text>
          {Platform.OS === 'web' ? (
            <Text style={styles.action}>Tap to open card</Text>
          ) : null}
        </View>
        <Pressable
          style={styles.closeBtn}
          onPress={(event) => {
            event.stopPropagation?.();
            setAlert(null);
          }}
          hitSlop={8}
        >
          <MaterialIcons name="close" size={18} color={theme.colors.white} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 56,
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 12,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...theme.shadows.card,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 18,
  },
  action: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
