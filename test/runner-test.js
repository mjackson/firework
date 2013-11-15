require('./test-helper');
var Runner = firework.Runner;

describe('A Runner', function () {

  var runner;

  beforeEach(function () {
    runner = new Runner(BASE_REF);
  });

  afterEach(function (done) {
    runner.clearPendingJobs();
    runner.clearStartedJobs();
    runner.stopAllWorkers(function () {
      done();
    });
  });

  describe('when it gets a new job', function () {
    var numPendingJobs;
    beforeEach(function (done) {
      numPendingJobs = 0;
      runner.pendingRef.once('child_added', function () {
        numPendingJobs++;
        done();
      });

      runner.addJob({ a: 'job' });
    });

    it('has one pending job', function () {
      assert.equal(numPendingJobs, 1);
    });
  });

  describe('with one worker', function () {
    var worker;
    beforeEach(function (done) {
      runner.incrementWorkers(function (newWorkers) {
        worker = newWorkers[0];
        done();
      });
    });

    it('has one worker', function () {
      assert.equal(runner.workers.length, 1);
    });

    describe('when the worker has an error', function () {
      beforeEach(function () {
        worker.emit('error');
      });

      it('replaces that worker with a new one', function () {
        assert.equal(runner.workers.length, 1);
        assert(runner.workers[0] !== worker);
      });
    });
  });

  describe('when there is a failed job', function () {
    beforeEach(function (done) {
      runner.startedRef.push({
        _failedAt: (new Date).getTime(),
        _error: 'Error: boom!'
      }, done);
    });

    describe('that is retried', function () {
      var numRetriedJobs;
      beforeEach(function (done) {
        numRetriedJobs = null;
        runner.retryFailedJobs(function (numJobs) {
          numRetriedJobs = numJobs;
          done();
        });
      });

      it('retries one job', function () {
        assert.equal(numRetriedJobs, 1);
      });
    });
  });

});
