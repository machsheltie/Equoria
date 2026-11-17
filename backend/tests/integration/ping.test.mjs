import request from 'supertest';
import app from '../../app.mjs';

describe('GET /ping', () => {
  it('should return { message: "pong" }', async () => {
    const res = await request(app).get('/ping');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'pong',
        success: true,
      }),
    );
    expect(res.body).toHaveProperty('timestamp');
  });
});
