var Firebase = require('firebase');
var Worker = require('../lib').Worker;

var queue = new Firebase('https://firework-tests.firebaseio.com');
var numWorkers = 5;

for (var i = 0; i < numWorkers; ++i) {
  (function (n) {

    // Create a new worker.
    var worker = new Worker({
      queue: queue,
      performJob: function (job, callback) {
        setTimeout(callback, Math.random() * 2000 | 0);
      }
    });

    worker.on('idle', function () {
      console.log('worker ' + n + ' is idle');
    });

    worker.on('start', function (job) {
      console.log('worker ' + n + ' started job ' + job.count);
    });

    worker.on('finish', function (job) {
      console.log('worker ' + n + ' finished job ' + job.count);
    });

    // Start the worker.
    worker.start();

  }(i));
}
