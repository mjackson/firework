var d = require('describe-property');
var isFunction = require('./utils/isFunction');
var Worker = require('./Worker');

/**
 * A runner is responsible for running many workers and restarting them when
 * they emit errors. The only argument here should be a function that knows how
 * to create new workers.
 */
function Runner(createWorker) {
  if (!isFunction(createWorker))
    throw new Error('Runner#createWorker must be a function');

  this._createWorker = createWorker;
  this.workerID = 0;
  this.workers = [];
}

Object.defineProperties(Runner.prototype, {

  /**
   * Sets the number of workers for this runner and calls the given callback
   * when the operation is complete. When removing workers, the callback receives
   * an array of the workers being removed after they have all finished up their
   * current job. When adding workers, the callback receives an array of the
   * new workers.
   */
  setNumberOfWorkers: d(function (numWorkers, callback) {
    numWorkers = Math.max(0, numWorkers);

    var workers = this.workers;
    var change = numWorkers - workers.length;

    if (change < 0) {
      // Remove oldest workers first.
      var removedWorkers = workers.splice(0, Math.abs(change));
      var numStoppedWorkers = 0;

      removedWorkers.forEach(function (worker) {
        worker.stop(function () {
          if (++numStoppedWorkers === removedWorkers.length && isFunction(callback))
            callback(removedWorkers);
        });
      });

      return;
    }

    var newWorkers = [], worker;
    for (var i = 0; i < change; ++i) {
      newWorkers.push(worker = this.createWorker(++this.workerID));
      worker.start();
    }

    workers.push.apply(workers, newWorkers);

    if (isFunction(callback))
      callback(newWorkers);
  }),

  /**
   * Adds the given number of workers to this runner.
   */
  incrementWorkers: d(function (howMany, callback) {
    if (isFunction(howMany)) {
      callback = howMany;
      howMany = 1;
    }

    this.setNumberOfWorkers(this.workers.length + howMany, callback);
  }),

  /**
   * Removes the given number of workers from this runner.
   */
  decrementWorkers: d(function (howMany, callback) {
    if (isFunction(howMany)) {
      callback = howMany;
      howMany = 1;
    }

    this.setNumberOfWorkers(this.workers.length - howMany, callback);
  }),

  /**
   * Alias for setNumberOfWorkers(0).
   */
  stopAllWorkers: d(function (callback) {
    this.setNumberOfWorkers(0, callback);
  }),

  /**
   * Creates a new worker that is bound to this runner.
   */
  createWorker: d(function (id) {
    var worker = this._createWorker(id);

    if (!(worker instanceof Worker))
      throw new Error('Runner#createWorker must return a Worker');

    worker.on('error', this.replaceWorker.bind(this, worker));

    worker.on('start', function (job) {
      console.log('worker ' + id + ' started job ' + job._key);
    });

    worker.on('failure', function (job, error) {
      console.log('job ' + job._key + ' failed: ' + error.toString());
    });

    worker.on('idle', function () {
      console.log('worker ' + id + ' is idle');
    });

    return worker;
  }),

  /**
   * Replaces the given worker with a new one.
   */
  replaceWorker: d(function (worker) {
    var workers = this.workers;
    var index = workers.indexOf(worker);

    if (index === -1)
      return;

    // Remove this worker and add a new one. When a worker emits
    // "error" it immediately stops working so no need to stop it.
    workers.splice(index, 1);
    this.incrementWorkers(1);
  }),

  /**
   * Returns a string representation of this Runner.
   */
  toString: d(function () {
    return '<Runner:' + this.workers.length + ' workers>';
  })

});

module.exports = Runner;
