/**
 * This example generates a bunch of jobs. Use it together
 * with the other example scripts so they have some work to do.
 */

var Firework = require('../modules');
var queue = Firework.createQueue('https://firework-tests.firebaseio-demo.com');
var maxCount = 10;
var interval = 10;

// Clear all pending/started jobs from the queue.
queue.removeAllJobs();

var numGeneratedJobs = 0;
var count = 0;
var timer = setInterval(function () {

  var jobCount = count++;

  // Push a new job onto the queue.
  queue.push({
    count: jobCount,
    time: (new Date).getTime(),
    name: 'monkey' + jobCount
  }, function () {
    console.log('generated job ' + jobCount);

    if (++numGeneratedJobs === maxCount)
      process.exit();
  }).setPriority(jobCount);

  if (count === maxCount)
    clearInterval(timer);

}, interval);
