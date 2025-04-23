import { jest } from '@jest/globals';
import nock from 'nock';

// Create a mock for the Resend API
export const mockResendApi = () => {
  // Ensure nock is configured to mock the Resend API endpoint
  nock('https://api.resend.com')
    .persist()
    .post('/emails')
    .reply(200, {
      id: 'mock-email-id',
      from: 'alerts@example.com',
      to: 'recipient@example.com',
      subject: 'Alert Notification',
      status: 'success',
    });
};

// Utility function to verify the Resend API was called
export const verifyResendApiCalled = () => {
  const pendingMocks = nock.pendingMocks();
  // If the API was called, there should be no pending mocks left
  expect(pendingMocks.length).toBe(0);
};

// Utility to setup a specific Resend API response expectation
export const expectResendApiCall = (expectedEmailData: {
  to: string[],
  from: string,
  subject: string,
  html?: string,
  text?: string
}) => {
  return nock('https://api.resend.com')
    .post('/emails', (body) => {
      // Check if email data matches expectations
      if (expectedEmailData.to) {
        expect(body.to).toEqual(expectedEmailData.to);
      }
      if (expectedEmailData.from) {
        expect(body.from).toEqual(expectedEmailData.from);
      }
      if (expectedEmailData.subject) {
        expect(body.subject).toEqual(expectedEmailData.subject);
      }
      if (expectedEmailData.html) {
        expect(body.html).toContain(expectedEmailData.html);
      }
      if (expectedEmailData.text) {
        expect(body.text).toContain(expectedEmailData.text);
      }
      return true;
    })
    .reply(200, {
      id: 'test-email-id',
      status: 'success'
    });
};

// Reset all nock interceptors between tests
export const resetResendMock = () => {
  nock.cleanAll();
};

// Helper to verify email content and parameters
export const mockResendApiWithContentCheck = (expectedParams: any) => {
  return nock('https://api.resend.com')
    .post('/emails', (body) => {
      // Perform assertions on the body
      const allExpectedParamsPresent = Object.keys(expectedParams).every(key => {
        if (typeof expectedParams[key] === 'string' || typeof expectedParams[key] === 'boolean') {
          return body[key] === expectedParams[key];
        } else if (typeof expectedParams[key] === 'object') {
          // For nested objects, check that they contain expected keys
          return Object.keys(expectedParams[key]).every(subKey => 
            JSON.stringify(body[key]).includes(expectedParams[key][subKey])
          );
        }
        return true;
      });
      
      return allExpectedParamsPresent;
    })
    .reply(200, {
      id: 'mock-email-id',
      from: expectedParams.from || 'alerts@example.com',
      to: expectedParams.to || 'recipient@example.com',
      status: 'success',
    });
};

// Helper to mock a failed email send
export const mockResendApiFailure = () => {
  return nock('https://api.resend.com')
    .post('/emails')
    .reply(400, {
      statusCode: 400,
      message: 'Bad request',
      name: 'Error',
    });
}; 