import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type ColorValue,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { theme } from '@/theme/tokens';

type ScreenProps = PropsWithChildren<{
  backgroundColor?: ColorValue;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  keyboardAware?: boolean;
  scrollViewProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
}>;

export function Screen({
  backgroundColor,
  children,
  contentContainerStyle,
  edges = ['top'],
  keyboardAware = false,
  scrollViewProps,
}: ScreenProps) {
  const { width } = useWindowDimensions();
  const horizontalPadding =
    width < theme.layout.compactWidth
      ? theme.layout.contentPaddingCompact
      : theme.layout.contentPadding;

  const content = (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: horizontalPadding },
        contentContainerStyle,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safeArea, backgroundColor ? { backgroundColor } : null]}
    >
      {keyboardAware ? (
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    gap: theme.spacing.xxl,
    maxWidth: theme.layout.contentMaxWidth,
    paddingBottom: theme.spacing.giant,
    paddingTop: theme.spacing.lg,
    width: '100%',
  },
});
