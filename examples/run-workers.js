/**
 * This example uses a Runner to manage Worker instances. A
 * Runner is able to gracefully increase/decrease the number
 * of workers in a worker pool and replace workers that have
 * errors with new ones.
 */

var Firework = require('../modules');
var queue = Firework.createQueue('https://firework-tests.firebaseio-demo.com');
var numWorkers = 1;

// This function is used to create a new worker.
function createWorker() {
  return Firework.createWorker(queue, function (job, callback) {
    // Simulate variable lengths of time.
    var random = parseInt(Math.random() * 1000)
    console.log('waiting:', random)
    var error
    setTimeout(function() {
      if (random.toString().match(/4/)) {
        error = 'BAD ' + random
      }
      callback(error)
    }, random);
  });
}

// Use a Firework.Runner to manage worker instances.
var runner = Firework.createRunner(createWorker);

runner.setNumberOfWorkers(numWorkers);
