import { jest } from '@jest/globals';

interface MockStripeAdmin {
  payouts: {
    update: jest.Mock;
  };
  customers: {
    retrieve: jest.Mock;
  };
}

// Create mock Stripe admin object
export const mockStripeAdmin: MockStripeAdmin = {
  payouts: {
    update: jest.fn().mockResolvedValue({
      id: 'po_mock123456',
      object: 'payout',
      amount: 1000,
      status: 'paused',
      automatic: true,
    }),
  },
  customers: {
    retrieve: jest.fn().mockResolvedValue({
      id: 'cus_mock123456',
      object: 'customer',
      email: 'customer@example.com',
      metadata: {
        company_name: 'Example Company',
      },
    }),
  },
};

// Reset all mocks between tests
export const resetStripeMocks = () => {
  mockStripeAdmin.payouts.update.mockClear();
  mockStripeAdmin.customers.retrieve.mockClear();
};

// Configure mock for payouts.update to fail
export const mockStripePayoutUpdateFailure = () => {
  mockStripeAdmin.payouts.update.mockRejectedValueOnce(new Error('Failed to pause payout'));
};

// Configure mock for specific customer data
export const mockStripeCustomerData = (customerData: any) => {
  mockStripeAdmin.customers.retrieve.mockResolvedValueOnce(customerData);
};

// Mock the Stripe payouts.update method
export const mockStripePayouts = () => {
  const mockUpdate = jest.fn().mockResolvedValue({
    id: 'po_mock',
    object: 'payout',
    status: 'canceled',
    amount: 1000,
    currency: 'usd',
    metadata: {
      auto_paused: 'true',
    },
  });

  return {
    payouts: {
      update: mockUpdate,
    },
    mockUpdate,
  };
};

// Verify that Stripe payouts.update was called with the expected parameters
export const verifyStripePayoutsPaused = (mockUpdate: jest.Mock, payoutId: string) => {
  expect(mockUpdate).toHaveBeenCalledWith(
    payoutId,
    { metadata: { auto_paused: 'true' } }
  );
};

// Reset the Stripe mock between tests
export const resetStripeMock = (mockUpdate: jest.Mock) => {
  mockUpdate.mockClear();
}; 