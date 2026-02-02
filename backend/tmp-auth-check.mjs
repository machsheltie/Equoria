import request from './node_modules/supertest/index.js';
import app from './app.mjs';
async function run() {
  const _response = await_request(app)
    .post('/api/auth/login')
    .send({ email: 'genetics6@test.com', password: 'TestPassword123!' });
  console.log('status', response.status);
  console.log(JSON.stringify(response.body, null, 2));
}
run();
