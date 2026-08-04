import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ProfileAvatar } from '@/components/profile-avatar';
import { SegmentedControl } from '@/components/segmented-control';
import { InsightBars } from '@/features/insights/profile-insights';

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

  it('exposes chart summaries and selected-point details without color dependence', async () => {
    const { getByLabelText, getByText } = await render(
      <InsightBars
        points={[
          { label: '03.08', value: 2 },
          { label: '04.08', value: 3 },
        ]}
        title="Antrenman sıklığı"
        valueLabel={(value) => `${value} antrenman`}
      />
    );
    expect(
      getByLabelText(/Antrenman sıklığı.*03\.08: 2 antrenman/)
    ).toBeTruthy();
    expect(getByText('04.08: 3 antrenman')).toBeTruthy();
    fireEvent.press(getByLabelText('03.08, 2 antrenman'));
    await waitFor(() => expect(getByText('03.08: 2 antrenman')).toBeTruthy());
  });
});
