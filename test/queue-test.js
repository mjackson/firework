require('./test-helper');
var Queue = firework.Queue;

describe('A Queue', function () {

  var queue;

  beforeEach(function (done) {
    queue = new Queue(BASE_REF);
    queue.clear(done);
  });

  describe('when a job is added', function () {
    beforeEach(function (done) {
      queue.addJob({ my: 'job' }, done);
    });

    it('has one pending job', function (done) {
      queue.getNumPendingJobs(function (n) {
        assert.equal(n, 1);
        done();
      });
    });

    it('has no started jobs', function (done) {
      queue.getNumStartedJobs(function (n) {
        assert.equal(n, 0);
        done();
      });
    });
  });

});
