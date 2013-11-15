var EventEmitter = require('events').EventEmitter;
var Firebase = require('firebase');
module.exports = Worker;

/**
 * A Worker is responsible for performing jobs, one at a time, as quickly as it can
 * pull them off a given Firebase location reference. When it gets a new job, it passes
 * it directly to the performJob function that is given in the constructor. This function
 * is called with "job" and "callback" arguments.
 *
 * Workers emit the following events:
 *
 *   - error          If there is a network/server error.
 *   - start          Receives a "job" argument immediately before a new job
 *                    is about to be performed.
 *   - failure        Receives "job" and "error" arguments when a job fails
 *                    for some reason.
 *   - success        Receives a "job" argument when a job finishes successfully.
 *   - finish         Receives a "job" argument when a job finishes, regardless
 *                    of success or failure.
 *
 * Workers keep track of how many jobs they have done in the `failureCount` and
 * `successCount` instance variables.
 */
function Worker(queue, performJob) {
  EventEmitter.call(this);

  if (typeof queue === 'string') {
    queue = new Firebase(queue);
  }

  this.queue = queue;
  this.isBusy = false;
  this.failureCount = 0;
  this.successCount = 0;

  if (isFunction(performJob)) {
    this.performJob = performJob;
  }
}

require('util').inherits(Worker, EventEmitter);

/**
 * Does the work required for the given job. This function should be
 * overridden in the constructor (or possibly a subclass) to actually
 * do something useful.
 */
Worker.prototype.performJob = function (job, callback) {
  console.warn('Nothing to do for job: ' + JSON.stringify(job));
  callback(null);
};

/**
 * Starts this worker.
 */
Worker.prototype.start = function () {
  this.nextJobQuery = this.queue.startAt().limit(1);
  this.nextJobQuery.on('child_added', function (snapshot) {
    this.nextJobRef = snapshot.ref();
    this.startTransaction();
  }, this);
};

/**
 * Stops this worker and calls the given callback when we've
 * finished any work that is still in progress.
 */
Worker.prototype.stop = function (callback) {
  if (this.nextJobQuery) {
    this.nextJobQuery.off();
    this.nextJobQuery = null;
  }

  // Make sure we don't try to do the next job when
  // the current one (if any) finishes.
  this.nextJobRef = null;

  if (isFunction(callback)) {
    if (this.isBusy) {
      this.once('finish', callback);
    } else {
      callback();
    }
  }
};

Worker.prototype.startTransaction = function () {
  if (!this.isBusy && this.nextJobRef) {
    this.isBusy = true;

    var ref = this.nextJobRef;
    this.nextJobRef = null;

    ref.transaction(this.claimJob.bind(this), this.finishTransaction.bind(this));
  }
};

Worker.prototype.claimJob = function (job) {
  this.currentJob = job;

  if (job) {
    // Remove this job from the queue. If this commit succeeds
    // then we have successfully claimed the job.
    return null;
  }
};

Worker.prototype.finishTransaction = function (error, committed, snapshot) {
  if (error) {
    // We may be in a bad state here. Notify listeners and stop working.
    this.emit('error', error);
  } else if (committed) {
    this.emit('start', this.currentJob);

    try {
      this.performJob(this.currentJob, this.finishCurrentJob.bind(this));
    } catch (error) {
      this.finishCurrentJob(error);
    }
  } else {
    // Another worker claimed the job.
    this.currentJob = null;
    this.getNextJob();
  }
};

Worker.prototype.finishCurrentJob = function (error) {
  var job = this.currentJob;
  this.currentJob = null;

  // Guard against misbehaving performJob functions that
  // mistakenly call this function more than once.
  if (!job) return;

  if (error) {
    this.failureCount += 1;
    this.emit('failure', job, error);
  } else {
    this.successCount += 1;
    this.emit('success', job);
  }

  this.emit('finish', job);

  this.getNextJob();
};

Worker.prototype.getNextJob = function () {
  this.isBusy = false;
  this.startTransaction();
};

function isFunction(object) {
  return object && typeof object === 'function';
}
