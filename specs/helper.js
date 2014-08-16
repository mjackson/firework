assert = require('assert');

if (typeof Firebase === 'undefined') {
  var moduleID = 'firebase'; // Stop Browserify.
  Firebase = require(moduleID);
}

Firework = require('../modules');

BASE_REF = new Firebase('https://firework-tests.firebaseio.com');

beforeEach(function (done) {
  BASE_REF.set(null, done);

  // This can take a while sometimes.
  this.timeout(0);
});
