/**
 * This example uses a Runner to manage Worker instances. A
 * Runner is able to gracefully increase/decrease the number
 * of workers in a worker pool and replace workers that have
 * errors with new ones.
 */

var firework = require('../modules');
var queue = firework.createQueue('https://firework-tests.firebaseio.com');
var numWorkers = 5;

// This function is used to create a new worker.
function createWorker() {
  return firework.createWorker(queue, function (job, callback) {
    // Simulate variable lengths of time.
    setTimeout(callback, Math.random() * 2000);
  });
}

// Use a firework.Runner to manage worker instances.
var runner = firework.createRunner(createWorker);

runner.setNumberOfWorkers(numWorkers);
