import type { PropsWithChildren } from 'react';
import { render } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
import TabLayout from '../app/(tabs)/_layout';

jest.mock('expo-router', () => {
  const { Text: MockText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const MockTabs = ({ children }: PropsWithChildren) => children;
  const MockScreen = ({
    options,
  }: {
    options: { tabBarAccessibilityLabel: string; title: string };
  }) => (
    <MockText accessibilityLabel={options.tabBarAccessibilityLabel}>
      {options.title}
    </MockText>
  );

  return { Tabs: Object.assign(MockTabs, { Screen: MockScreen }) };
});

describe('TabLayout', () => {
  it('contains the four Turkish navigation tabs', async () => {
    const { getByLabelText } = await render(<TabLayout />);

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
  });
});
