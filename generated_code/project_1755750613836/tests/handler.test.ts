import { handler } from './handler';

describe('Lambda Handler', () => {
  it('should process valid request successfully', async () => {
    const event = {
      body: JSON.stringify({ test: 'data' })
    };
    
    const result = await handler(event as any, {} as any);
    
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
  });
  
  it('should handle errors gracefully', async () => {
    const event = {
      body: 'invalid json'
    };
    
    const result = await handler(event as any, {} as any);
    
    expect(result.statusCode).toBe(500);
  });
});