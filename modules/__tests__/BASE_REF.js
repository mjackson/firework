if (typeof Firebase === 'undefined')
  Firebase = require('firebase');

var BASE_REF = new Firebase('https://firework-tests.firebaseio.com');

beforeEach(function (done) {
  BASE_REF.set(null, done);

  // This can take a while sometimes.
  this.timeout(0);
});

module.exports = BASE_REF;
