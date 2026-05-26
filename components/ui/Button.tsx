import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, View } from 'react-native';
import { theme } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  leftIcon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  leftIcon,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        styles[`size_${size}` as keyof typeof styles] as ViewStyle,
        pressed && !disabled && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? theme.colors.primary : theme.colors.white}
          size="small"
        />
      ) : (
        <View style={styles.inner}>
          {leftIcon && <View style={styles.iconWrap}>{leftIcon}</View>}
          <Text style={[styles.text, styles[`${variant}Text` as keyof typeof styles] as TextStyle, styles[`size_${size}Text` as keyof typeof styles] as TextStyle]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginRight: 8,
  },
  primary: {
    backgroundColor: theme.colors.primary,
    ...theme.shadows.soft,
  },
  secondary: {
    backgroundColor: theme.colors.dark,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  ghost: {
    backgroundColor: theme.colors.creamDark,
  },
  size_small: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: theme.borderRadius.sm,
  },
  size_medium: {
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  size_large: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.975 }],
  },
  disabled: {
    opacity: 0.42,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  size_smallText: { fontSize: 14 },
  size_mediumText: { fontSize: 15 },
  size_largeText: { fontSize: 16 },
  primaryText: {
    color: theme.colors.white,
  },
  secondaryText: {
    color: theme.colors.white,
  },
  outlineText: {
    color: theme.colors.primary,
  },
  ghostText: {
    color: theme.colors.charcoal,
  },
});
