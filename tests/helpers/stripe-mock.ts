import { jest } from '@jest/globals';
// Import Stripe types if available, otherwise use any
// import Stripe from 'stripe';

interface MockStripeAdmin {
  payouts: {
    // Specify Promise<any> or Promise<Stripe.Payout>
    update: jest.Mock<() => Promise<any>>;
  };
  customers: {
    // Specify Promise<any> or Promise<Stripe.Customer>
    retrieve: jest.Mock<() => Promise<any>>;
  };
}

// Create mock Stripe admin object
export const mockStripeAdmin: MockStripeAdmin = {
  payouts: {
    // Add return type to mock definition
    update: jest.fn<() => Promise<any>>().mockResolvedValue({
      id: 'po_mock123456',
      object: 'payout',
      amount: 1000,
      status: 'paused',
      automatic: true,
      // Add other fields expected by Stripe.Payout if needed
    }),
  },
  customers: {
    // Add return type to mock definition
    retrieve: jest.fn<() => Promise<any>>().mockResolvedValue({
      id: 'cus_mock123456',
      object: 'customer',
      email: 'customer@example.com',
      metadata: {
        company_name: 'Example Company',
      },
      // Add other fields expected by Stripe.Customer if needed
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
  // The mock definition now supports rejecting Promise<any>
  mockStripeAdmin.payouts.update.mockRejectedValueOnce(new Error('Failed to pause payout'));
};

// Configure mock for specific customer data
export const mockStripeCustomerData = (customerData: any) => {
  // The mock definition now supports resolving Promise<any>
  mockStripeAdmin.customers.retrieve.mockResolvedValueOnce(customerData);
};

// Mock the Stripe payouts.update method
export const mockStripePayouts = () => {
  // Add return type to mock definition
  const mockUpdate = jest.fn<() => Promise<any>>().mockResolvedValue({
    id: 'po_mock',
    object: 'payout',
    status: 'canceled',
    amount: 1000,
    currency: 'usd',
    metadata: {
      auto_paused: 'true',
    },
    // Add other fields if needed
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
  expect(mockUpdate).toHaveBeenCalledWith(payoutId, { metadata: { auto_paused: 'true' } });
};

// Reset the Stripe mock between tests
export const resetStripeMock = (mockUpdate: jest.Mock) => {
  mockUpdate.mockClear();
};
