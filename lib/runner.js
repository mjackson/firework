var Firebase = require('firebase');
var Worker = require('./worker');
module.exports = Runner;

/**
 * A Runner is responsible for running and managing workers. It can scale the
 * number of workers up or down, gracefully handle worker errors, and retry
 * failed jobs.
 *
 * Internally, a runner uses two locations underneath its primary location
 * reference: pendingJobs and startedJobs. When you add jobs to the runner they
 * are added to the pendingJobs location, which workers pull from.
 *
 * All workers created by a runner use its performJob function to actually do
 * the work they are supposed to do. The logError function is used to log
 * errors from workers just before they are replaced with new ones.
 */
function Runner(baseRef, performJob, logError) {
  if (typeof baseRef === 'string') {
    baseRef = new Firebase(baseRef);
  }

  this.pendingRef = baseRef.child('pendingJobs');
  this.startedRef = baseRef.child('startedJobs');

  this.performJob = performJob;
  this.logError = logError;
  this.workers = [];
}

/**
 * Adds the given job to this runner's list of pending jobs. The job may be any
 * object that can be stored in Firebase. It is passed directly to your worker.
 */
Runner.prototype.addJob = function (job, callback) {
  this.pendingRef.push(job, callback);
};

/**
 * Completely erases this runner's list of pending jobs.
 */
Runner.prototype.clearPendingJobs = function (callback) {
  this.pendingRef.set(null, callback);
};

/**
 * Completely erases this runner's list of started jobs.
 */
Runner.prototype.clearStartedJobs = function (callback) {
  this.startedRef.set(null, callback);
};

/**
 * Retries all failed jobs up to the maximum number given in the maxJobs
 * argument. Calls the given callback when it is finished with the number
 * of jobs that were retried.
 */
Runner.prototype.retryFailedJobs = function (maxJobs, callback) {
  if (isFunction(maxJobs)) {
    callback = maxJobs;
    maxJobs = null;
  }

  maxJobs = maxJobs || 0;
  var numRetriedJobs = 0;

  this.startedRef.once('value', function (snapshot) {
    var ref, job;
    snapshot.forEach(function (child) {
      ref = child.ref();
      job = child.val();

      if (isFailedJob(job)) {
        // Retry and remove from startedJobs.
        this.addJob(job, function () {
          ref.remove();
        });

        if (++numRetriedJobs === maxJobs) {
          return true; // Cancel forEach loop.
        }
      }
    }.bind(this));

    if (isFunction(callback)) {
      callback(numRetriedJobs);
    }
  }, this);
};

function isFailedJob(object) {
  return object && object._failedAt && !object._succeededAt;
}

/**
 * Sets the number of workers for this runner and calls the given callback
 * when the operation is complete. When removing workers, the callback receives
 * an array of the workers being removed after they have all finished up their
 * current job. When adding workers, the callback receives an array of the
 * new workers.
 */
Runner.prototype.setNumberOfWorkers = function (numWorkers, callback) {
  numWorkers = Math.max(0, numWorkers);

  var workers = this.workers;
  var change = numWorkers - workers.length;

  if (change < 0) {
    // Remove oldest workers first.
    var removedWorkers = workers.splice(0, Math.abs(change));

    var numStoppedWorkers = 0;
    function workerStopped() {
      if (++numStoppedWorkers === removedWorkers.length && isFunction(callback)) {
        callback(removedWorkers);
      }
    }

    removedWorkers.forEach(function (worker) {
      worker.stop(workerStopped);
    });
  }

  var newWorkers = [], worker;
  while (change > 0) {
    newWorkers.push(worker = this.createWorker());
    worker.start();
    change -= 1;
  }

  workers.push.apply(workers, newWorkers);

  if (isFunction(callback)) {
    callback(newWorkers);
  }
};

/**
 * Adds the given number of workers to this runner.
 */
Runner.prototype.incrementWorkers = function (howMany, callback) {
  if (isFunction(howMany)) {
    callback = howMany;
    howMany = null;
  }

  this.setNumberOfWorkers(this.workers.length + (howMany || 1), callback);
};

/**
 * Removes the given number of workers from this runner.
 */
Runner.prototype.decrementWorkers = function (howMany, callback) {
  if (isFunction(howMany)) {
    callback = howMany;
    howMany = null;
  }

  this.setNumberOfWorkers(this.workers.length - (howMany || 1), callback);
};

/**
 * Alias for setNumberOfWorkers(0).
 */
Runner.prototype.stopAllWorkers = function (callback) {
  this.setNumberOfWorkers(0, callback);
};

/**
 * Creates a new worker and sets up this runner to handle its events.
 */
Runner.prototype.createWorker = function () {
  var worker = new Worker(this.pendingRef, this.performJob);

  worker.on('error', this._workerError.bind(this, worker));
  worker.on('start', this._jobDidStart.bind(this));
  worker.on('failure', this._jobDidFail.bind(this));
  worker.on('success', this._jobDidSucceed.bind(this));

  return worker;
};

Runner.prototype._workerError = function (worker, error) {
  if (isFunction(this.logError)) {
    this.logError(error);
  }

  var workers = this.workers;
  var index = workers.indexOf(worker);

  if (index !== -1) {
    // Remove this worker and add a new one. When a worker emits
    // "error" it immediately stops working so no need to stop it.
    workers.splice(index, 1);
    this.incrementWorkers(1);
  }
};

Runner.prototype._jobDidStart = function (job) {
  var ref = this.startedRef.push();
  var properties = { _startedAt: serverTimestamp() };
  saveJobWithProperties(ref, job, properties);
  job._startedName = ref.name();
};

Runner.prototype._jobDidFail = function (job, error) {
  var ref = this.startedRef.child(job._startedName);
  var properties = { _failedAt: serverTimestamp() };
  if (error) properties._error = error.toString();
  saveJobWithProperties(ref, job, properties);
};

Runner.prototype._jobDidSucceed = function (job) {
  var ref = this.startedRef.child(job._startedName);
  var properties = { _succeededAt: serverTimestamp() };
  saveJobWithProperties(ref, job, properties);
};

function saveJobWithProperties(ref, job, properties) {
  var value = mergeProperties(properties, job);
  delete value._startedName; // Don't save this.

  ref.set(value, function (error) {
    // An error here probably means there is a configuration
    // or permissions error. Fail fast.
    if (error) throw error;
  });
}

function mergeProperties(target, source) {
  for (var property in source) {
    if (source.hasOwnProperty(property)) {
      target[property] = source[property];
    }
  }
}

function serverTimestamp() {
  return Firebase.ServerValue.TIMESTAMP;
}

function isFunction(object) {
  return object && typeof object === 'function';
}
