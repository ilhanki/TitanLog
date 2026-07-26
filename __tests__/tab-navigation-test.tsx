import type { PropsWithChildren } from 'react';
import { render } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
import TabLayout from '../app/(tabs)/_layout';

jest.mock('expo-router', () => {
  const { Text: MockText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const MockTabs = ({ children }: PropsWithChildren) => children;
  const MockScreen = ({
    name,
    options,
  }: {
    name: string;
    options: { tabBarAccessibilityLabel: string; title: string };
  }) => (
    <MockText
      accessibilityLabel={options.tabBarAccessibilityLabel}
      testID={`tab-route-${name}`}
    >
      {options.title}
    </MockText>
  );

  return { Tabs: Object.assign(MockTabs, { Screen: MockScreen }) };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 24, left: 0, right: 0, top: 0 }),
}));

describe('TabLayout', () => {
  it('contains the four Turkish navigation tabs', async () => {
    const { getAllByTestId, getByLabelText, queryByTestId } = await render(
      <TabLayout />
    );

    expect(
      getByLabelText(appStrings.navigation.homeAccessibilityLabel)
    ).toBeTruthy();
    expect(
      getByLabelText(appStrings.navigation.workoutAccessibilityLabel)
    ).toBeTruthy();
    expect(
      getByLabelText(appStrings.navigation.progressAccessibilityLabel)
    ).toBeTruthy();
    expect(
      getByLabelText(appStrings.navigation.profileAccessibilityLabel)
    ).toBeTruthy();
    expect(getAllByTestId(/^tab-route-/)).toHaveLength(4);
    expect(queryByTestId('tab-route-auth/sign-in')).toBeNull();
    expect(queryByTestId('tab-route-auth/sign-up')).toBeNull();
  });
});
