var firework = require('../lib');
var queue = new firework.Queue('https://firework-tests.firebaseio.com');

module.exports = function () {
  return new firework.Worker(queue, function (job, callback) {
    console.log(JSON.stringify(job, null, 2));
    setTimeout(callback, 100);
  });
};
