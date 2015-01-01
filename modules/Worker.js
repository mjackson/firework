var d = require('describe-property');
var EventEmitter = require('events').EventEmitter;
var isFunction = require('./utils/isFunction');
var Queue = require('./Queue');

/**
 * A worker is responsible for performing jobs, one at a time, as quickly as it can
 * pull them off a given queue. When it gets a new job, it calls the performJob
 * function that is given in the constructor. This function is called with the current
 * job and a node-style callback argument.
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
function Worker(queue, performJob) {
  EventEmitter.call(this);

  if (!isFunction(performJob))
    throw new Error('Worker#performJob must be a function');

  this.performJob = performJob;

  if (!(queue instanceof Queue))
    queue = new Queue(queue);

  this.queue = queue;
  this.failureCount = 0;
  this.successCount = 0;
  this.isBusy = false;

  queue.setupWorker(this);
}

Worker.prototype = Object.create(EventEmitter.prototype, {

  constructor: d(Worker),

  /**
   * Starts this worker.
   */
  start: d(function () {
    if (this._query)
      return;

    var query = this.queue.createQuery();

    // The "child_added" event sometimes gets fired more often than it should. It
    // seems the Firebase client errs on the side of emitting extraneous events,
    // which isn't necessarily bad. We just need to know that.
    query.on('child_added', function (snapshot) {
      this._nextSnapshot = snapshot;
      this._tryToWork();
    }, this);

    this._query = query;
  }),

  /**
   * Stops this worker and calls the given callback after finishing
   * any work that is currently in progress.
   */
  stop: d(function (callback) {
    if (this._query) {
      this._query.off();
      this._query = null;
    }

    if (!isFunction(callback))
      return;

    if (this.isBusy) {
      this.once('idle', callback);
    } else {
      callback();
    }
  }),

  /**
   * Starts working on the given job.
   */
  startJob: d(function (job) {
    this.emit('start', job);

    // Perform the job. Guard against misbehaving performJob
    // functions that call the callback more than once.
    var alreadyCalled = false;
    var self = this;
    function finishJob(error) {
      if (alreadyCalled) {
        console.error('Error: The callback given to performJob was called more than once!');
      } else {
        alreadyCalled = true;
        self.finishJob(job, error);
      }
    }

    try {
      this.performJob(job, finishJob);
    } catch (error) {
      finishJob(error);
    }
  }),

  /**
   * Finishes the given job.
   */
  finishJob: d(function (job, error) {
    if (error) {
      this.failureCount += 1;
      this.emit('failure', job, error);
    } else {
      this.successCount += 1;
      this.emit('success', job);
    }

    this.emit('finish', job);

    this._getNextJob(job);
  }),

  _getNextJob: d(function (previousJob) {
    this.isBusy = false;

    if (this._nextSnapshot) {
      this._tryToWork(previousJob);
    } else if (previousJob) {
      this.emit('idle');
    }
  }),

  _tryToWork: d(function (previousJob) {
    if (!this._nextSnapshot || this.isBusy)
      return;

    this.isBusy = true;

    var ref = this._nextSnapshot.ref();
    this._nextSnapshot = null;

    var nextJob;
    function claimJob(job) {
      nextJob = job;

      // Remove this job from the queue.
      return null;
    }

    var self = this;
    function onComplete(error, committed) {
      if (error) {
        // We may be in a bad state here. Notify listeners and stop working.
        self.emit('error', error);
      } else if (committed && nextJob) {
        // Ensure the job has a key.
        if (!nextJob._key)
          nextJob._key = ref.key();

        // We successfully claimed a job. Start working on it.
        self.startJob(nextJob);
      } else {
        // Another worker claimed the job. Get the next one.
        self._getNextJob(previousJob);
      }
    }

    ref.transaction(claimJob, onComplete, false);
  }),

  /**
   * Returns a string representation of this Worker.
   */
  toString: d(function () {
    return '<Worker:' + this.queue + '>';
  })

});

module.exports = Worker;
