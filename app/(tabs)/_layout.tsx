import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBarIcon } from '@/components/tab-bar-icon';
import { appStrings } from '@/constants/strings';
import { getTabBarLayout } from '@/navigation/tab-bar-layout';
import { theme } from '@/theme/tokens';

export default function TabLayout() {
  const { bottom } = useSafeAreaInsets();
  const tabBarLayout = getTabBarLayout(bottom);

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarLabelStyle: {
          fontSize: theme.typography.size.caption,
          fontWeight: theme.typography.weight.semibold,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.backgroundElevated,
          borderTopColor: theme.colors.border,
          borderTopWidth: theme.borders.hairline,
          height: tabBarLayout.height,
          paddingBottom: tabBarLayout.paddingBottom,
          paddingTop: theme.spacing.sm,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarAccessibilityLabel:
            appStrings.navigation.homeAccessibilityLabel,
          tabBarIcon: ({ color, focused, size }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              name="home-variant-outline"
              size={size}
            />
          ),
          title: appStrings.navigation.home,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          tabBarAccessibilityLabel:
            appStrings.navigation.workoutAccessibilityLabel,
          tabBarIcon: ({ color, focused, size }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              name="dumbbell"
              size={size}
            />
          ),
          title: appStrings.navigation.workout,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarAccessibilityLabel:
            appStrings.navigation.progressAccessibilityLabel,
          tabBarIcon: ({ color, focused, size }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              name="chart-line"
              size={size}
            />
          ),
          title: appStrings.navigation.progress,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarAccessibilityLabel:
            appStrings.navigation.profileAccessibilityLabel,
          tabBarIcon: ({ color, focused, size }) => (
            <TabBarIcon
              color={color}
              focused={focused}
              name="account-outline"
              size={size}
            />
          ),
          title: appStrings.navigation.profile,
        }}
      />
    </Tabs>
  );
}
