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
  if (typeof ref === 'string') {
    ref = new Firebase(ref);
  }

  if (!(ref instanceof Firebase)) {
    throw new Error('Invalid ref: ' + ref);
  }

  this.ref = ref;
  this.pendingJobs = ref.child('pendingJobs');
  this.startedJobs = ref.child('startedJobs');
}

/**
 * Adds the given job to this queue. Jobs should be "plain" JavaScript
 * objects that contain the data necessary to do some work. The following
 * job property names are reserved:
 *
 *   _name
 *   _startedAt
 *   _failedAt
 *   _succeededAt
 *   _error
 *
 * Returns the newly created child location reference.
 */
Queue.prototype.addJob = function (job, callback) {
  return this.pendingJobs.push(job, callback);
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

  this.startedJobs.once('value', function (snapshot) {
    var job;
    snapshot.forEach(function (child) {
      job = child.val();

      if (isFailedJob(job)) {
        // Retry and remove from startedJobs.
        this.addJob(job, function () {
          child.ref().remove();
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

Queue.prototype._jobWasStarted = function (job) {
  var properties = mergeProperties({ _startedAt: serverTimestamp() }, job);
  this.startedJobs.child(job._name).update(properties, afterSave);
};

Queue.prototype._jobDidFail = function (job, error) {
  var properties = mergeProperties({ _failedAt: serverTimestamp() }, job);
  if (error) properties._error = error.toString();
  this.startedJobs.child(job._name).update(properties, afterSave);
};

Queue.prototype._jobDidSucceed = function (job) {
  var properties = mergeProperties({ _succeededAt: serverTimestamp() }, job);
  this.startedJobs.child(job._name).update(properties, afterSave);
};

function afterSave(error) {
  // An error here probably means there is a configuration
  // or permissions error. Fail fast.
  if (error) throw error;
}

function serverTimestamp() {
  return Firebase.ServerValue.TIMESTAMP;
}

function mergeProperties(target, source) {
  for (var property in source) {
    if (source.hasOwnProperty(property)) {
      target[property] = source[property];
    }
  }

  return target;
}

function isFunction(object) {
  return object && typeof object === 'function';
}
