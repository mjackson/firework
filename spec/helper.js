assert = require('assert');
Firebase = require('firebase');
Firework = require('../modules');

BASE_REF = new Firebase('https://firework-tests.firebaseio.com');

beforeEach(function (done) {
  BASE_REF.set(null, done);

  // This can take a while sometimes.
  this.timeout(0);
});
