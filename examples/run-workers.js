var Firebase = require('firebase');
var Queue = require('../lib').Queue;
var Runner = require('../lib').Runner;

var queue = new Queue('https://firework-tests.firebaseio.com');
var numWorkers = 5;

var runner = new Runner({
  queue: queue,
  performJob: function (job, callback) {
    // Simulate variable lengths of time.
    setTimeout(callback, Math.random() * 2000);
  }
});

runner.setNumberOfWorkers(numWorkers);
