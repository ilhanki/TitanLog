import { render } from '@testing-library/react-native';

import { FoundationScreen } from '@/components/foundation-screen';
import { appStrings } from '@/constants/strings';

describe('FoundationScreen', () => {
  it('presents the TitanLog foundation status in Turkish', async () => {
    const { getByRole, getByText } = await render(<FoundationScreen />);

    expect(getByText(appStrings.brandName)).toBeTruthy();
    expect(
      getByRole('header', { name: appStrings.foundation.title })
    ).toBeTruthy();
    expect(getByText(appStrings.foundation.status)).toBeTruthy();
  });
});
