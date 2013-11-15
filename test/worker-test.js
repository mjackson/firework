var assert = require('assert');
var Worker = require('../lib/worker');

describe('A Worker', function () {

  var worker, performedJob;

  function performJob(job, callback) {
    performedJob = job;
    callback(null);
  }

  beforeEach(function () {
    worker = new Worker('https://queue-tests.firebaseio.com', performJob);
  });

  afterEach(function () {
    worker.stop();
    worker.removeAllListeners();
    worker = performedJob = null;
  });

  describe('when a job is added to the queue', function () {
    var job, startedJob, finishedJob;
    beforeEach(function (done) {
      startedJob = finishedJob = null;

      worker.on('start', function (job) {
        startedJob = job;
      });

      worker.on('finish', function (job) {
        finishedJob = job;
        done();
      });

      worker.queue.push(job = { a: 'b' });
      worker.start();
    });

    it('starts the job', function () {
      assert.deepEqual(startedJob, job);
    });

    it('calls the performJob callback', function () {
      assert(performedJob);
      assert.deepEqual(performedJob, job);
    });

    it('finishes the job', function () {
      assert.deepEqual(finishedJob, job);
    });
  });

});
