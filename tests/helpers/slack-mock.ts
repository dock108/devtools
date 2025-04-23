import { jest } from '@jest/globals';

// Create a global mock for fetch to intercept Slack API calls
export const mockSlackApi = () => {
  global.fetch = jest.fn().mockImplementation((url, options) => {
    if (url.toString().includes('hooks.slack.com')) {
      // Return a successful response for Slack webhook calls
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });
    }

    // Pass through any other fetch calls
    return Promise.reject(new Error(`Unhandled fetch call to ${url}`));
  });
};

// Utility function to check if Slack was called with expected payload
export const verifySlackApiCalled = (fetchMock: jest.Mock) => {
  expect(fetchMock).toHaveBeenCalled();
  
  // Get the URL from the last call
  const url = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0];
  expect(url.toString()).toContain('hooks.slack.com');
  
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
};

// Check the payload contains expected content
export const verifySlackPayload = (fetchMock: jest.Mock, expectedContent: string[]) => {
  const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  const options = lastCall[1];
  const body = JSON.parse(options.body as string);
  
  for (const content of expectedContent) {
    expect(body.text).toContain(content);
  }
  
  return body;
};

// Reset mock between tests
export const resetSlackMock = () => {
  if (global.fetch && typeof (global.fetch as jest.Mock).mockReset === 'function') {
    (global.fetch as jest.Mock).mockReset();
  }
}; 