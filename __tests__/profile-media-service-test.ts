import {
  profileMediaPath,
  ProfileMediaError,
  validateSelectedPhoto,
} from '@/features/profile/profile-media-service';

describe('private profile media paths', () => {
  it('uses an owner-derived private path', () => {
    expect(profileMediaPath('11111111-1111-4111-8111-111111111111')).toBe(
      '11111111-1111-4111-8111-111111111111/avatar.jpg'
    );
  });

  it('rejects unsupported MIME types and oversized sources', () => {
    expect(() =>
      validateSelectedPhoto({ mimeType: 'image/gif', uri: 'file:///photo.gif' })
    ).toThrow(ProfileMediaError);
    expect(() =>
      validateSelectedPhoto({
        fileSize: 8 * 1024 * 1024 + 1,
        mimeType: 'image/jpeg',
        uri: 'file:///photo.jpg',
      })
    ).toThrow(ProfileMediaError);
    expect(() =>
      validateSelectedPhoto({
        mimeType: 'image/webp',
        uri: 'file:///photo.webp',
      })
    ).not.toThrow();
  });

  it('rejects traversal and non-owner path input', () => {
    expect(() => profileMediaPath('../other-user')).toThrow(ProfileMediaError);
  });
});
