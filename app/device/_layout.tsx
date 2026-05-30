import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { theme } from '@/constants/theme';

const NAV_ITEMS = [
  { path: '/device/home', label: 'Home', icon: 'home' as const },
  { path: '/device/inbox', label: 'Cards', icon: 'inbox' as const },
  { path: '/device/keepsakes', label: 'Keepsakes', icon: 'bookmark' as const },
];

function DeviceNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const unreadCount = useUnreadCount();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Don't show nav on login page or card viewer
  const hideNav = pathname === '/device/login' || pathname.startsWith('/device/card/');
  if (hideNav || !user) return null;

  if (isDesktop) {
    return (
      <View style={nav.sidebar}>
        {/* Logo */}
        <View style={nav.sidebarLogo}>
          <View style={nav.logoCircle}>
            <MaterialIcons name="tablet-mac" size={20} color={theme.colors.white} />
          </View>
          <Text style={nav.logoText}>Cherie Device</Text>
        </View>

        {/* Nav links */}
        <View style={nav.sidebarLinks}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.path;
            return (
              <Pressable
                key={item.path}
                style={[nav.sidebarItem, active && nav.sidebarItemActive]}
                onPress={() => router.push(item.path as any)}
              >
                <View style={nav.sidebarIconWrap}>
                  <MaterialIcons name={item.icon} size={20} color={active ? theme.colors.primary : theme.colors.mediumGray} />
                  {item.icon === 'inbox' && unreadCount > 0 && (
                    <View style={nav.badge}><Text style={nav.badgeText}>{unreadCount}</Text></View>
                  )}
                </View>
                <Text style={[nav.sidebarLabel, active && nav.sidebarLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Sign out */}
        <Pressable style={nav.signOutRow} onPress={signOut}>
          <MaterialIcons name="logout" size={18} color={theme.colors.mediumGray} />
          <Text style={nav.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  // Mobile bottom tab bar
  return (
    <View style={nav.tabBar}>
      {NAV_ITEMS.map(item => {
        const active = pathname === item.path;
        return (
          <Pressable
            key={item.path}
            style={nav.tabItem}
            onPress={() => router.push(item.path as any)}
          >
            <View style={nav.tabIconWrap}>
              <MaterialIcons name={item.icon} size={22} color={active ? theme.colors.primary : theme.colors.mediumGray} />
              {item.icon === 'inbox' && unreadCount > 0 && (
                <View style={nav.badge}><Text style={nav.badgeText}>{unreadCount}</Text></View>
              )}
            </View>
            <Text style={[nav.tabLabel, active && nav.tabLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DeviceShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const pathname = usePathname();
  const { user } = useAuth();
  const hideNav = pathname === '/device/login' || pathname.startsWith('/device/card/');

  return (
    <View style={{ flex: 1, flexDirection: isDesktop && !hideNav && user ? 'row' : 'column' }}>
      {isDesktop && <DeviceNav />}
      <View style={{ flex: 1 }}>
        {children}
      </View>
      {!isDesktop && <DeviceNav />}
    </View>
  );
}

export default function DeviceLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.cream }} edges={['top', 'bottom']}>
          <DeviceShell>
            <Stack screenOptions={{ headerShown: false }} />
          </DeviceShell>
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const nav = StyleSheet.create({
  // Desktop sidebar
  sidebar: {
    width: 220,
    backgroundColor: theme.colors.white,
    borderRightWidth: 1,
    borderRightColor: theme.colors.lightGray,
    paddingVertical: 24,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  sidebarLogo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 },
  logoCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 16, fontWeight: '700', color: theme.colors.dark, fontFamily: theme.fonts.serif },
  sidebarLinks: { flex: 1, gap: 4 },
  sidebarItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
  },
  sidebarItemActive: { backgroundColor: theme.colors.primaryLight },
  sidebarIconWrap: { position: 'relative' },
  sidebarLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.mediumGray },
  sidebarLabelActive: { color: theme.colors.primary },
  signOutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
  },
  signOutText: { fontSize: 14, color: theme.colors.mediumGray, fontWeight: '500' },
  // Mobile tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderTopWidth: 1, borderTopColor: theme.colors.lightGray,
    paddingBottom: 8, paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabIconWrap: { position: 'relative' },
  tabLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.mediumGray },
  tabLabelActive: { color: theme.colors.primary },
  // Shared
  badge: {
    position: 'absolute', top: -4, right: -6,
    backgroundColor: theme.colors.primary,
    borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: theme.colors.white },
});
