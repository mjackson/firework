var d = require('d');
var isFirebase = require('./utils/isFirebase');
var isFunction = require('./utils/isFunction');
var getNumChildren = require('./utils/getNumChildren');
var mergeProperties = require('./utils/mergeProperties');

if (typeof Firebase === 'undefined') {
  var moduleID = 'firebase'; // Stop Browserify.
  Firebase = require(moduleID);
}

var SERVER_TIMESTAMP = Firebase.ServerValue.TIMESTAMP;

/**
 * A queue is responsible for keeping jobs organized in two separate lists:
 * "pending" and "started". Pending jobs are those that have yet to run and
 * started jobs are those that have already been run at least once.
 *
 * As workers run jobs in the queue, the queue stores information about when
 * the job was started and finished, as well as any error that occurred when
 * executing the job. When jobs do fail, a queue is able to retry those jobs
 * easily by moving them back to the pending list (see retryFailedJobs).
 */
function Queue(ref) {
  if (typeof ref === 'string')
    ref = new Firebase(ref);

  if (!isFirebase(ref))
    throw new Error('Invalid Firebase location reference: ' + ref);

  this.ref = ref;
  this.pendingJobs = ref.child('pendingJobs');
  this.startedJobs = ref.child('startedJobs');
  this.runningJobs = ref.child('startedJobs').equalTo('running');
  this.failedJobs  = ref.child('startedJobs').equalTo('failed');
  this.completedJobs = ref.child('startedJobs').equalTo('completed');
}

Object.defineProperties(Queue.prototype, {

  /**
   * Creates a Firebase query object that workers can use to pull jobs
   * off this queue.
   */
  createQuery: d(function () {
    return this.pendingJobs.startAt().limit(1);
  }),

  /**
   * Adds the given job to this queue. Jobs should be "plain" JavaScript
   * objects that contain the data necessary to do some work. The following
   * job property names are reserved:
   *
   *   _name
   *   _startedAt
   *   _succeededAt
   *   _failedAt
   *   _error
   *
   * The _name property is really only semi-reserved. If given, it will be
   * used as the name for the new child reference. Thus, it must be a valid
   * Firebase location reference name.
   *
   * Returns the newly created child location reference.
   */
  addJob: d(function (job, callback) {
    var pendingJobs = this.pendingJobs;
    var ref = job._name ? pendingJobs.child(job._name) : pendingJobs.push();
    var priority = job._priority || null;
    console.log('addJob', ref.toString());
    ref.setWithPriority(job, priority, callback);
    return ref;
  }),

  /**
   * Removes all pending jobs from the queue.
   */
  removeAllPendingJobs: d(function (callback) {
    this.pendingJobs.set(null, callback);
  }),

  /**
   * Removes all started jobs from the queue.
   */
  removeAllStartedJobs: d(function (callback) {
    this.startedJobs.set(null, callback);
  }),

  /**
   * Removes all jobs, both pending and started, from the queue.
   */
  removeAllJobs: d(function (callback) {
    this.removeAllPendingJobs(this.removeAllStartedJobs.bind(this, callback));
  }),

  /**
  * Removes all jobs that are running from the queue.
  */
  removeAllRunningJobs: d(function(callback) {
    this.runningJobs.once('value', function(snap) {
      snap.forEach(function(child) {
        child.ref().remove()
      })
      if (isFunction(callback)) { callback() }
    })
  }),

  /**
  * Removes all failed jobs from the queue.
  */
  removeAllFailedJobs: d(function(callback) {
    this.failedJobs.once('value', function(snap) {
      snap.forEach(function(child) {
        child.ref().remove()
      })
      if (isFunction(callback)) { callback() }
    })
  }),

  /**
  * Removes all completed jobs from the queue.
  */
  removeAllCompletedJobs: d(function(callback) {
    this.completedJobs.once('value', function(snap) {
      snap.forEach(function(child) {
        child.ref().remove()
      })
      if (isFunction(callback)) { callback() }
    })
  }),

  /**
   * Moves failed jobs from the started list back to pending, up to the
   * maximum number given in the maxJobs argument (defaults to all failed
   * jobs). Calls the given callback when it is finished with the number of
   * jobs that were moved.
   */
  retryFailedJobs: d(function (maxJobs, callback) {
    if (isFunction(maxJobs)) {
      callback = maxJobs;
      maxJobs = null;
    }

    maxJobs = maxJobs || 0;
    var numRetriedJobs = 0;

    var self = this;
    this.failedJobs.once('value', function (snapshot) {
      var job;
      snapshot.forEach(function (child) {
        job = child.val();

        if (!isFailedJob(job))
          return;

        self._retryJob(child.ref(), job);

        if (++numRetriedJobs === maxJobs)
          return true; // Cancel forEach loop.
      });

      if (isFunction(callback))
        callback(numRetriedJobs);
    }, this);
  }),

  _retryJob: d(function (ref, job) {
    this.addJob(job, function(error) {
      if (!error) { ref.remove(); }
    })
  }),

  /**
   * Calls the given callback with the number of jobs that are pending.
   */
  getNumPendingJobs: d(function (callback) {
    getNumChildren(this.pendingJobs, callback);
  }),

  /**
   * Calls the given callback with the number of jobs that are started.
   */
  getNumStartedJobs: d(function (callback) {
    getNumChildren(this.startedJobs, callback);
  }),

  /**
  * Calls the given callback with the number of jobs that are running.
  */
  getNumRunningJobs: d(function (callback) {
    getNumChildren(this.runningJobs, callback);
  }),

  /**
  * Calls the given callback with the number of jobs that are failed.
  */
  getNumFailedJobs: d(function (callback) {
    getNumChildren(this.failedJobs, callback);
  }),

  /**
  * Calls the given callback with the number of jobs that are completed.
  */
  getNumCompletedJobs: d(function (callback) {
    getNumChildren(this.completedJobs, callback);
  }),

  /**
   * Used internally to setup the given worker object to report to this queue.
   */
  setupWorker: d(function (worker) {
    var self = this;

    worker.on('start', function (job) {
      job = mergeProperties({ _startedAt: SERVER_TIMESTAMP }, job);
      self.startedJobs.child(job._name).setWithPriority(job, 'running', handleError);
    });

    worker.on('failure', function (job, error) {
      job = mergeProperties({ _failedAt: SERVER_TIMESTAMP }, job);
      job._error = error.toString() || null;
      self.startedJobs.child(job._name).setWithPriority(job, 'failed', handleError);
    });

    worker.on('success', function (job) {
      job = mergeProperties({ _succeededAt: SERVER_TIMESTAMP }, job);
      self.startedJobs.child(job._name).setWithPriority(job, 'completed', handleError);
    });
  }),

  /**
   * Returns a string representation of this Queue.
   */
  toString: d(function () {
    return '<Queue:' + this.ref.toString() + '>';
  })

});

Object.defineProperties(Queue.prototype, {

  /**
   * Shorthand for Queue#addJob.
   */
  push: d(Queue.prototype.addJob),

  /**
   * Shorthand for Queue#removeAllPendingJobs.
   */
  clear: d(Queue.prototype.removeAllPendingJobs)

});

function isFailedJob(object) {
  return object && object._failedAt && !object._succeededAt;
}

function handleError(error) {
  // An error here probably means there is a configuration
  // or permissions error. Fail fast.
  if (error)
    throw error;
}

module.exports = Queue;
