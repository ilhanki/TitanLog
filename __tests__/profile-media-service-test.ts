import {
  profileMediaPath,
  ProfileMediaError,
} from '@/features/profile/profile-media-service';

describe('private profile media paths', () => {
  it('uses an owner-derived private path', () => {
    expect(profileMediaPath('11111111-1111-4111-8111-111111111111')).toBe(
      '11111111-1111-4111-8111-111111111111/avatar.jpg'
    );
  });

  it('rejects traversal and non-owner path input', () => {
    expect(() => profileMediaPath('../other-user')).toThrow(ProfileMediaError);
  });
});
