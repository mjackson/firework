var EventEmitter = require('events').EventEmitter;
var Queue = require('./queue');
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
 *   - idle           Called when this worker stops working.
 */
function Worker(options) {
  options = options || {};

  EventEmitter.call(this);

  this.queue = options.queue;
  if (!(this.queue instanceof Queue)) {
    this.queue = new Queue(this.queue);
  }

  if (isFunction(options.performJob)) {
    this.performJob = options.performJob;
  }

  this.failureCount = 0;
  this.successCount = 0;
  this.isBusy = false;

  this._setupQueue();
}

require('util').inherits(Worker, EventEmitter);

Worker.prototype._setupQueue = function () {
  var queue = this.queue;
  this.on('start', queue._jobWasStarted.bind(queue));
  this.on('failure', queue._jobDidFail.bind(queue));
  this.on('success', queue._jobDidSucceed.bind(queue));
};

/**
 * Starts this worker.
 */
Worker.prototype.start = function () {
  if (!this.query) {
    var pendingJobs = this.queue.pendingJobs;
    this.query = pendingJobs.startAt().limit(1);
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
 * Stops this worker and calls the given callback after finishing
 * any work that is currently in progress.
 */
Worker.prototype.stop = function (callback) {
  if (this.query) {
    this.query.off();
    this.query = null;
  }

  if (isFunction(callback)) {
    if (this.isBusy) {
      this.once('idle', callback);
    } else {
      callback();
    }
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

Worker.prototype.toString = function () {
  return '<Worker:' + this.queue.toString() + '>';
};

function isFunction(object) {
  return object && typeof object === 'function';
}
