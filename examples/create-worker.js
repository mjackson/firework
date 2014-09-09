/**
 * This is an example of how to structure a create-worker.js
 * file that can be used from the command line with the firework
 * binary, e.g.:
 *
 *   $ bin/firework examples/create-worker.js -w 5
 */

var Firework = require('../modules');
var queue = Firework.createQueue('https://firework-tests.firebaseio-demo.com');

module.exports = function () {
  return Firework.createWorker(queue, function (job, callback) {
    console.log(JSON.stringify(job, null, 2));
    setTimeout(callback, 100);
  });
};
