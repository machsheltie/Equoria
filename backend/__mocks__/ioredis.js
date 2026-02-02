class RedisMock {
  constructor() {
    this.status = 'ready';
  }
  on(event, callback) {
    if (event === 'ready' || event === 'connect') { callback(); }
    return this;
  }
  async get(_key) {
    return null;
  }
  async set(_key, _value, _mode, _duration) {
    return 'OK';
  }
  async del(_key) {
    return 1;
  }
  async quit() {
    return 'OK';
  }
  async disconnect() {
    return 'OK';
  }
  duplicate() {
    return new RedisMock();
  }
}

export default RedisMock;
