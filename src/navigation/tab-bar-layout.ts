import { theme } from '@/theme/tokens';

export type TabBarLayout = {
  height: number;
  paddingBottom: number;
};

export function getTabBarLayout(bottomInset: number): TabBarLayout {
  const safeBottomInset = Math.max(0, bottomInset);

  return {
    height: theme.layout.tabBarContentHeight + safeBottomInset,
    paddingBottom: theme.spacing.xs + safeBottomInset,
  };
}
