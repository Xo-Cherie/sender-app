import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { theme } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  name?: string;
}

export function Input({ label, error, name, style, ...props }: InputProps) {
  const inputId = React.useMemo(() => `input-${name || label || Math.random().toString(36)}`, [name, label]);

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label} nativeID={`${inputId}-label`}>
          {label}
        </Text>
      )}
      <TextInput
        nativeID={inputId}
        accessibilityLabel={label || props.placeholder}
        accessibilityLabelledBy={label ? `${inputId}-label` : undefined}
        accessibilityHint={props.placeholder}
        style={[
          styles.input,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor={theme.colors.mediumGray}
        {...props}
      />
      {error && (
        <Text style={styles.error} nativeID={`${inputId}-error`}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.charcoal,
    marginBottom: 7,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1.5,
    borderColor: theme.colors.borderGray,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 13,
    fontSize: 16,
    color: theme.colors.dark,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  error: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 5,
  },
});
