assert = require('assert');
Firebase = require('firebase');
firework = require('../lib');

BASE_REF = new Firebase('https://firework-tests.firebaseio.com');

// Warm up the connection before running tests.
before(function (done) {
  BASE_REF.once('value', function () {
    done();
  });

  // This can take a while sometimes.
  this.timeout(0);
});
