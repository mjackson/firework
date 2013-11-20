var Firebase = require('firebase');
var Queue = require('../lib').Queue;
var Runner = require('../lib').Runner;
var Worker = require('../lib').Worker;

var queue = new Queue('https://firework-tests.firebaseio.com');
var numWorkers = 5;

var runner = new Runner(function () {
  var worker = new Worker(queue, function (job, callback) {
    // Simulate variable lengths of time.
    setTimeout(callback, Math.random() * 2000);
  });

  return worker;
});

runner.setNumberOfWorkers(numWorkers);
