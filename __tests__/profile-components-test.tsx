import { fireEvent, render } from '@testing-library/react-native';

import { ProfileAvatar } from '@/components/profile-avatar';
import { SegmentedControl } from '@/components/segmented-control';

describe('profile shared components', () => {
  it('announces the fallback avatar meaningfully', async () => {
    const { getByLabelText, getByText } = await render(
      <ProfileAvatar name="İlhan Kılıç" uri={null} />
    );
    expect(getByLabelText('İlhan Kılıç profil simgesi')).toBeTruthy();
    expect(getByText('İK')).toBeTruthy();
  });

  it('announces selected analytics periods and changes explicitly', async () => {
    const onChange = jest.fn();
    const { getByRole } = await render(
      <SegmentedControl
        accessibilityLabel="İçgörü dönemi"
        onChange={onChange}
        options={[
          { label: 'Hafta', value: 'week' },
          { label: 'Ay', value: 'month' },
        ]}
        value="week"
      />
    );
    expect(
      getByRole('tab', { name: 'Hafta' }).props.accessibilityState
    ).toEqual({ selected: true });
    fireEvent.press(getByRole('tab', { name: 'Ay' }));
    expect(onChange).toHaveBeenCalledWith('month');
  });
});
