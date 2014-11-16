exports.version = require('./version');

exports.Queue  = require('./Queue');
exports.Runner = require('./Runner');
exports.Worker = require('./Worker');

exports.createQueue = function (ref) {
  return new exports.Queue(ref);
};

exports.createRunner = function (createWorker) {
  return new exports.Runner(createWorker);
};

exports.createWorker = function (queue, performJob) {
  return new exports.Worker(queue, performJob);
};
