require('./test-helper');
var Runner = firework.Runner;

describe('A Runner', function () {

  var runner;

  beforeEach(function () {
    runner = new Runner({ queue: BASE_REF });
  });

  afterEach(function (done) {
    runner.stopAllWorkers(function () {
      done();
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

});
