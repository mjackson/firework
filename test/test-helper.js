assert = require('assert');
Firebase = require('firebase');
firework = require('../lib');

BASE_REF = new Firebase('https://firework-tests.firebaseio.com');

beforeEach(function (done) {
  BASE_REF.set(null, done);

  // This can take a while sometimes.
  this.timeout(0);
});
