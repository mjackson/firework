exports.version = require('../package').version;
exports.Queue  = require('./queue');
exports.Runner = require('./runner');
exports.Worker = require('./worker');

exports.createQueue = function (ref) {
  return new exports.Queue(ref);
};

exports.createRunner = function (createWorker) {
  return new exports.Runner(createWorker);
};

exports.createWorker = function (queue, performJob) {
  return new exports.Worker(queue, performJob);
};
