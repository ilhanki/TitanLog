import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DatasetAccessGuard } from '@/features/data-safety/dataset-access-guard';

const mockAssertAccountAccess = jest.fn();
const mockDatabase = {};
let mockUser: { id: string } | null = null;

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDatabase }));
jest.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({ initializing: false, user: mockUser }),
}));
jest.mock('@/features/auth/auth-service', () => ({ signOut: jest.fn() }));
jest.mock('@/features/data-safety/dataset-ownership-repository', () => ({
  DatasetOwnershipError: class DatasetOwnershipError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  createDatasetOwnershipRepository: () => ({
    assertAccountAccess: mockAssertAccountAccess,
  }),
}));

describe('local dataset access guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  it('keeps guest-first offline use available', async () => {
    const { getByText } = await render(
      <DatasetAccessGuard>
        <Text>Yerel uygulama</Text>
      </DatasetAccessGuard>
    );
    expect(getByText('Yerel uygulama')).toBeTruthy();
  });

  it('blocks local data for a different signed-in owner', async () => {
    mockUser = { id: 'account-b' };
    const OwnershipError = jest.requireMock(
      '@/features/data-safety/dataset-ownership-repository'
    ).DatasetOwnershipError;
    mockAssertAccountAccess.mockRejectedValue(
      new OwnershipError('owner_mismatch')
    );
    const { getByText, queryByText } = await render(
      <DatasetAccessGuard>
        <Text>Gizli yerel veri</Text>
      </DatasetAccessGuard>
    );
    await waitFor(() =>
      expect(getByText('Bu veri kümesi başka bir hesaba ait')).toBeTruthy()
    );
    expect(queryByText('Gizli yerel veri')).toBeNull();
    expect(mockAssertAccountAccess).toHaveBeenCalledWith('account-b');
  });
});
