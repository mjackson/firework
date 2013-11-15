var Firebase = require('firebase');
var Worker = require('../lib').Worker;

var queue = new Firebase('https://firework-tests.firebaseio.com');

// Create a new worker.
var worker = new Worker({
  queue: queue,
  performJob: function (job, callback) {
    setTimeout(callback, Math.random() * 2000 | 0);
  }
});

worker.on('idle', function () {
  console.log('idle');
});

worker.on('start', function (job) {
  console.log('started job ' + job.count);
});

worker.on('finish', function (job) {
  console.log('finished job ' + job.count);
});

// Start the worker.
worker.start();
