import { getTabBarLayout } from '@/navigation/tab-bar-layout';
import { theme } from '@/theme/tokens';

describe('getTabBarLayout', () => {
  it('adds the dynamic bottom inset to the tab bar dimensions', () => {
    expect(getTabBarLayout(24)).toEqual({
      height: theme.layout.tabBarContentHeight + 24,
      paddingBottom: theme.spacing.xs + 24,
    });
  });

  it('does not add negative inset space', () => {
    expect(getTabBarLayout(-12)).toEqual({
      height: theme.layout.tabBarContentHeight,
      paddingBottom: theme.spacing.xs,
    });
  });
});
