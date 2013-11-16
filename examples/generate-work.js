var Firebase = require('firebase');
var Queue = require('../lib').Queue;

var queue = new Queue('https://firework-tests.firebaseio.com');

var maxCount = 30;
var interval = 10;

// Clear all pending/started jobs from the queue.
queue.clear();

var numGeneratedJobs = 0;
var count = 0;
var timer = setInterval(function () {

  var jobCount = count++;

  // Push a new job onto the queue.
  queue.push({
    count: jobCount,
    time: (new Date).getTime()
  }, function () {
    console.log('generated job ' + jobCount);

    if (++numGeneratedJobs === maxCount) {
      process.exit();
    }
  });

  if (count === maxCount) {
    clearInterval(timer);
  }

}, interval);
