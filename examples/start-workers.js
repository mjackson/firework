/**
 * This example manually creates a set number of workers and
 * sets up event listeners on each that log stuff to the console
 * when interesting things happen. This is a low-level interface
 * to managing workers. For a higher-level interface, see the
 * run-workers.js example.
 */

var Firework = require('../modules');
var queue = Firework.createQueue('https://firework-tests.firebaseio.com');
var numWorkers = 5;

function startWorker(n) {
  // Create a new worker.
  var worker = Firework.createWorker(queue, function (job, callback) {
    // Simulate variable lengths of time.
    setTimeout(callback, Math.random() * 2000);
  });

  worker.on('start', function (job) {
    console.log('worker ' + n + ' started job ' + job.count);
  });

  worker.on('finish', function (job) {
    console.log('worker ' + n + ' finished job ' + job.count);
  });

  worker.on('idle', function () {
    console.log('worker ' + n + ' is idle');
  });

  // Start the worker.
  worker.start();
}

for (var i = 0; i < numWorkers; ++i)
  startWorker(i);
