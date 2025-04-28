import { jest } from '@jest/globals';

// Create a global mock for fetch to intercept Slack API calls
export const mockSlackApi = () => {
  // Add types to url and options, ensure return type matches fetch signature
  global.fetch = jest
    .fn()
    .mockImplementation(
      async (url: URL | RequestInfo, options?: RequestInit): Promise<Response> => {
        const urlString = url.toString();
        if (urlString.includes('hooks.slack.com')) {
          // Return a successful Response object
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Pass through any other fetch calls - Requires original fetch or specific handling
        // For simplicity in mocking, let's throw an error for unhandled calls
        throw new Error(`Unhandled fetch call in mockSlackApi to ${urlString}`);
        // Alternatively, store original fetch and call it: return originalFetch(url, options);
      },
    );
};

// Utility function to check if Slack was called with expected payload
export const verifySlackApiCalled = (fetchMock: jest.Mock) => {
  expect(fetchMock).toHaveBeenCalled();

  // Get the URL from the last call (already checked for type in mock implementation)
  const url = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
  expect(url).toContain('hooks.slack.com');

  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
};

// Check the payload contains expected content
export const verifySlackPayload = (fetchMock: jest.Mock, expectedContent: string[]) => {
  const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  const options = lastCall[1] as RequestInit; // Add type assertion for options
  const body = JSON.parse(options?.body as string);

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
