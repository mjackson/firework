var EventEmitter = require('events').EventEmitter;
var Firebase = require('firebase');
module.exports = Worker;

/**
 * A worker is responsible for performing jobs, one at a time, as quickly as it can
 * pull them off a given Firebase location reference. When it gets a new job, it passes
 * it directly to the performJob function that is given in the constructor. This function
 * is called with the current job and a node-style callback argument.
 *
 * Workers keep track of how many jobs they have done in the `failureCount` and
 * `successCount` instance variables.
 *
 * Workers emit the following events:
 *
 *   - error          Called when there is a network/server error.
 *   - start          Receives a "job" argument immediately before a new job
 *                    is about to be performed.
 *   - failure        Receives "job" and "error" arguments when a job fails
 *                    for some reason.
 *   - success        Receives a "job" argument when a job finishes successfully.
 *   - finish         Receives a "job" argument when a job finishes, regardless
 *                    of success or failure.
 *   - idle           Called when this worker goes from a working state to
 *                    having nothing to do.
 */
function Worker(options) {
  options = options || {};

  EventEmitter.call(this);

  this.queue = makeRef(options.queue || options.ref);
  if (!(this.queue instanceof Firebase)) {
    throw new Error('A worker needs a queue, try options.queue');
  }

  if (isFunction(options.performJob)) {
    this.performJob = options.performJob;
  }

  if (options.startedRef) {
    this.storeStartedJobs(options.startedRef);
  }

  this.failureCount = 0;
  this.successCount = 0;
  this.isBusy = false;
}

require('util').inherits(Worker, EventEmitter);

Worker.toString = function () {
  return 'Worker';
};

Worker.prototype.toString = function () {
  return require('util').format('<%s:%s>', this.constructor, this.queue.toString());
};

/**
 * Starts this worker.
 */
Worker.prototype.start = function () {
  if (!this.query) {
    this.query = this.queue.startAt().limit(1);
    this.query.on('child_added', function (snapshot) {
      // In my tests this event sometimes gets fired more often than
      // it should. All I can figure is that the Firebase code must
      // err on the side of emitting extraneous events, which isn't
      // necessarily bad. We just need to know that.
      this.nextSnapshot = snapshot;
      this._tryToWork();
    }, this);
  }
};

/**
 * Stops this worker and calls the given callback when we've
 * finished any work that is still in progress.
 */
Worker.prototype.stop = function (callback) {
  if (this.query) {
    this.query.off();
    this.query = null;
  }

  if (isFunction(callback)) {
    if (this.isBusy) {
      this.once('idle', function () {
        callback();
      });
    } else {
      callback();
    }
  }
};

Worker.prototype._tryToWork = function (previousJob) {
  if (this.nextSnapshot && !this.isBusy) {
    this.isBusy = true;

    var ref = this.nextSnapshot.ref();
    this.nextSnapshot = null;

    var nextJob;
    function claimJob(job) {
      nextJob = job;
      if (job) {
        return null; // Remove this job from the queue.
      }
    }

    var onComplete = function (error, committed) {
      if (error) {
        // We may be in a bad state here. Notify listeners and stop working.
        this.emit('error', error);
      } else if (committed) {
        // We successfully claimed the job. Start working on it.
        this.startJob(nextJob);
      } else {
        // Another worker claimed the job. Get the next one.
        this.getNextJob(previousJob);
      }
    }.bind(this);

    ref.transaction(claimJob, onComplete, false);
  }
};

/**
 * Starts working on the given job.
 */
Worker.prototype.startJob = function (job) {
  this.emit('start', job);

  // Perform the job. Guard against misbehaving performJob
  // functions that call the callback more than once.
  var alreadyCalled = false;
  var finishJob = function (error) {
    if (alreadyCalled) {
      console.error('Error: The callback given to performJob was called more than once!');
    } else {
      alreadyCalled = true;
      this.finishJob(job, error);
    }
  }.bind(this);

  try {
    this.performJob(job, finishJob);
  } catch (error) {
    finishJob(error);
  }
};

/**
 * Does the work required for the given job. This function should be
 * overridden in the constructor (or possibly a subclass) to actually
 * do something useful.
 */
Worker.prototype.performJob = function (job, callback) {
  console.warn('Nothing to do for job: ' + job);
  callback();
};

/**
 * Finish up the given job and emit events.
 */
Worker.prototype.finishJob = function (job, error) {
  if (error) {
    this.failureCount += 1;
    this.emit('failure', job, error);
  } else {
    this.successCount += 1;
    this.emit('success', job);
  }

  this.emit('finish', job);

  this.getNextJob(job);
};

/**
 * Tries to get the next job off the queue and run it.
 */
Worker.prototype.getNextJob = function (previousJob) {
  this.isBusy = false;

  if (this.nextSnapshot) {
    this._tryToWork(previousJob);
  } else if (previousJob) {
    this.emit('idle');
  }
};

/**
 * Sets up listeners that store jobs at a separate location reference
 * as they are worked on. When jobs are stored, they may have the following
 * extra properties:
 *
 *   - _startedAt     The timestamp when the job was started
 *   - _failedAt      The timestamp when the job failed
 *   - _error         A string representation of the error for a failed job
 *   - _succeededAt   The timestamp when the job finished successfully
 */
Worker.prototype.storeStartedJobs = function (startedRef) {
  var ref = makeRef(startedRef);

  if (!(ref instanceof Firebase)) {
    throw new Error('Invalid Firebase location reference: ' + ref);
  }

  function afterSave(error) {
    // An error here probably means there is a configuration
    // or permissions error. Fail fast.
    if (error) throw error;
  }

  this.on('start', function (job) {
    var childRef = ref.push(job, afterSave);
    childRef.update({ _startedAt: serverTimestamp() }, afterSave);

    // Save this so we can update the ref when the job finishes.
    job._startedRef = ref;
  });

  this.on('failure', function (job, error) {
    var properties = { _failedAt: serverTimestamp() };
    if (error) properties._error = error.toString();
    job._startedRef.update(properties, afterSave);
  });

  this.on('success', function (job) {
    job._startedRef.update({ _succeededAt: serverTimestamp() }, afterSave);
  });
};

function serverTimestamp() {
  return Firebase.ServerValue.TIMESTAMP;
}

function isFunction(object) {
  return object && (typeof object === 'function');
}

function makeRef(object) {
  return (typeof object === 'string') ? new Firebase(object) : object;
}
