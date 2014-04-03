var Firebase = require('firebase');
module.exports = Queue;

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

  if (!(ref instanceof Firebase))
    throw new Error('Invalid Firebase location reference: ' + ref);

  this.ref = ref;
  this.pendingJobs = ref.child('pendingJobs');
  this.startedJobs = ref.child('startedJobs');
}

/**
 * Creates a Firebase query object that workers can use to pull jobs
 * off this queue.
 */
Queue.prototype.createQuery = function () {
  return this.pendingJobs.startAt().limit(1);
};

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
Queue.prototype.addJob = function (job, callback) {
  var pendingJobs = this.pendingJobs;
  var ref = job._name ? pendingJobs.child(job._name) : pendingJobs.push();

  ref.set(job, callback);

  return ref;
};

// Shorthand.
Queue.prototype.push = Queue.prototype.addJob;

/**
 * Removes all pending jobs from the queue.
 */
Queue.prototype.removeAllPendingJobs = function (callback) {
  this.pendingJobs.set(null, callback);
};

// Shorthand.
Queue.prototype.clear = Queue.prototype.removeAllPendingJobs;

/**
 * Removes all started jobs from the queue.
 */
Queue.prototype.removeAllStartedJobs = function (callback) {
  this.startedJobs.set(null, callback);
};

/**
 * Removes all jobs, both pending and started, from the queue.
 */
Queue.prototype.removeAllJobs = function (callback) {
  this.removeAllPendingJobs(this.removeAllStartedJobs.bind(this, callback));
};

/**
 * Moves failed jobs from the started list back to pending, up to the
 * maximum number given in the maxJobs argument (defaults to all failed
 * jobs). Calls the given callback when it is finished with the number of
 * jobs that were moved.
 */
Queue.prototype.retryFailedJobs = function (maxJobs, callback) {
  if (isFunction(maxJobs)) {
    callback = maxJobs;
    maxJobs = null;
  }

  maxJobs = maxJobs || 0;
  var numRetriedJobs = 0;

  var self = this;
  this.startedJobs.once('value', function (snapshot) {
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
};

Queue.prototype._retryJob = function (ref, job) {
  this.addJob(job, ref.remove.bind(ref));
};

function isFailedJob(object) {
  return object && object._failedAt && !object._succeededAt;
}

/**
 * Calls the given callback with the number of jobs that are pending.
 */
Queue.prototype.getNumPendingJobs = function (callback) {
  getNumChildren(this.pendingJobs, callback);
};

/**
 * Calls the given callback with the number of jobs that are started.
 */
Queue.prototype.getNumStartedJobs = function (callback) {
  getNumChildren(this.startedJobs, callback);
};

function getNumChildren(ref, callback) {
  ref.once('value', function (snapshot) {
    callback(snapshot.numChildren());
  });
}

Queue.prototype.toString = function () {
  return '<Queue:' + this.ref.toString() + '>';
};

/* worker actions */

var SERVER_TIMESTAMP = Firebase.ServerValue.TIMESTAMP;

Queue.prototype._jobWasStarted = function (job) {
  var properties = mergeProperties({ _startedAt: SERVER_TIMESTAMP }, job);
  this.startedJobs.child(job._name).update(properties, afterSave);
};

Queue.prototype._jobDidFail = function (job, error) {
  var properties = mergeProperties({ _failedAt: SERVER_TIMESTAMP }, job);
  if (error) properties._error = error.toString();
  this.startedJobs.child(job._name).update(properties, afterSave);
};

Queue.prototype._jobDidSucceed = function (job) {
  var properties = mergeProperties({ _succeededAt: SERVER_TIMESTAMP }, job);
  this.startedJobs.child(job._name).update(properties, afterSave);
};

function afterSave(error) {
  // An error here probably means there is a configuration
  // or permissions error. Fail fast.
  if (error)
    throw error;
}

function mergeProperties(target, source) {
  for (var property in source) {
    if (source.hasOwnProperty(property))
      target[property] = source[property];
  }

  return target;
}

function isFunction(object) {
  return typeof object === 'function';
}
