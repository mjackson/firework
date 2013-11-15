var Firebase = require('firebase');

var queue = new Firebase('https://firework-tests.firebaseio.com');
var maxCount = 30;
var interval = 10;

queue.set(null);

var count = 0;
var timer = setInterval(function () {
  queue.push({
    count: count++,
    time: (new Date).getTime()
  });

  console.log('generated job ' + count);

  if (count === maxCount) {
    clearInterval(timer);
  }
}, interval);
