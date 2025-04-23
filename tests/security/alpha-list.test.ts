import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { createMocks } from 'node-mocks-http';

// Mock the Deno.env.get function
const originalEnv = process.env;

describe('alpha-allow-list validation', () => {
  let validateSignupHandler: any;

  beforeEach(() => {
    // Reset module registry before each test
    jest.resetModules();
    
    // Mock environment variables
    process.env = { 
      ...originalEnv, 
      ALPHA_ALLOW_LIST: 'allowed@example.com,another-allowed@company.co' 
    };
    
    // Mock the Deno object
    global.Deno = {
      env: {
        get: (key: string) => process.env[key]
      }
    } as any;
  });

  afterEach(() => {
    process.env = originalEnv;
    delete global.Deno;
  });

  it('should reject signup for non-allowed email', async () => {
    // Create mock request with non-allowed email
    const { req } = createMocks({
      method: 'POST',
      body: {
        email: 'unauthorized@example.com',
        user_metadata: {}
      }
    });

    // Mock the Response constructor
    const mockJsonResponse = jest.fn();
    global.Response = jest.fn().mockImplementation((body, init) => ({
      body,
      init,
      json: mockJsonResponse
    })) as any;

    // Simulate the function call
    const response = await validateSignupHandler(req);
    
    // Check response
    expect(response.init.status).toBe(403);
    const responseData = JSON.parse(response.body);
    expect(responseData.error).toBe('Signup not allowed. Please contact beta@dock108.ai for access.');
  });

  it('should allow signup for allowed email', async () => {
    // Create mock request with allowed email
    const { req } = createMocks({
      method: 'POST',
      body: {
        email: 'allowed@example.com',
        user_metadata: {}
      }
    });

    // Mock the Response constructor
    const mockJsonResponse = jest.fn();
    global.Response = jest.fn().mockImplementation((body, init) => ({
      body,
      init,
      json: mockJsonResponse
    })) as any;

    // Simulate the function call
    const response = await validateSignupHandler(req);
    
    // Check response
    expect(response.init.status).toBe(200);
    const responseData = JSON.parse(response.body);
    expect(responseData.success).toBe(true);
  });

  it('should handle case insensitivity in email validation', async () => {
    // Create mock request with mixed-case email
    const { req } = createMocks({
      method: 'POST',
      body: {
        email: 'ALLOWED@example.com',
        user_metadata: {}
      }
    });

    // Mock the Response constructor
    const mockJsonResponse = jest.fn();
    global.Response = jest.fn().mockImplementation((body, init) => ({
      body,
      init,
      json: mockJsonResponse
    })) as any;

    // Simulate the function call
    const response = await validateSignupHandler(req);
    
    // Check response
    expect(response.init.status).toBe(200);
    const responseData = JSON.parse(response.body);
    expect(responseData.success).toBe(true);
  });
}); 