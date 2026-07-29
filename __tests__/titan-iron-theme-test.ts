import { colors, radii, shadows, spacing } from '@/theme/tokens';

describe('Titan Iron theme', () => {
  it('provides semantic graphite, copper, state, and text roles', () => {
    expect(colors).toEqual(
      expect.objectContaining({
        accentOnColor: expect.any(String),
        background: expect.any(String),
        borderStrong: expect.any(String),
        dangerSoft: expect.any(String),
        information: expect.any(String),
        primary: expect.any(String),
        successSoft: expect.any(String),
        surfaceMuted: expect.any(String),
        surfacePressed: expect.any(String),
        textDisabled: expect.any(String),
        warningSoft: expect.any(String),
      })
    );
    expect(spacing.lg).toBe(16);
    expect(radii.md).toBeLessThan(radii.xl);
    expect(shadows).not.toHaveProperty('accent');
  });

  it('does not use blue or purple as the primary accent', () => {
    expect(colors.primary).toBe('#E58A3B');
    expect(colors.primary).not.toMatch(/2F80FF|7C3AED|8B5CF6/i);
  });
});
