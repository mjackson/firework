[![build status](https://secure.travis-ci.org/mjackson/firework.png)](http://travis-ci.org/mjackson/firework)

[Firework](https://github.com/mjackson/firework) is a distributed, fault-tolerant work queue for [Firebase](https://www.firebase.com/).

### Creating Jobs

Since you're using Firebase, you'll probably want to create jobs directly from the browser. To do this, setup a new Firebase location reference that will serve as your queue. To start, you may want to make sure that this location is writable by everyone but only readable by your server (i.e. worker) process.

In this example, we'll assume that your queue is located at `https://my-firebase.firebaseio.com/myQueue`. In your client code, you'll want to create a new child of the `pendingJobs` child of that location reference, like so:

```js
var jobs = new Firebase('https://my-firebase.firebaseio.com/myQueue/pendingJobs');
jobs.push({ my: 'job' });
```

That's it. You've now pushed a job onto the queue for a worker to process sometime later.

It should be noted that workers pull from the *beginning* of the queue (FIFO). If you have jobs of varying importance you can use a [priority](https://www.firebase.com/docs/ordered-data.html) to run some jobs before others.

```js
jobs.push().setWithPriority({ important: 'job' }, 0);
jobs.push().setWithPriority({ less: 'important' }, 100);
```

Firework also provides an API for creating jobs from within your server process. A `Firework.Queue` (see **Processing Jobs** below) has a `push` method for this purpose.

```js
var queue = require('firework').createQueue('https://my-firebase.firebaseio.com/myQueue');
queue.push({ my: 'job' });
```

Important: The following job property names are reserved:

  * _key
  * _startedAt
  * _succeededAt
  * _failedAt
  * _error

### Processing Jobs

The easiest way to start processing the jobs on a Firework queue is to use the `firework` command:

```sh
$ firework create-worker.js -w 5
```

The `-w` argument specifies the number of workers to use. When a worker has an unrecoverable error it is removed from the worker pool and replaced with a new one.

The `create-worker.js` module that you pass to `firework` should export a function that is used to create new workers. To process jobs from the queue we pushed onto in the **Creating Jobs** section above, our `create-worker.js` file could look something like this:

```js
var Firework = require('firework');
var queue = Firework.createQueue('https://my-firebase.firebaseio.com/myQueue');

module.exports = function () {
  return Firework.createWorker(queue, function (job, callback) {
    // process the given job.

    // call the callback when you're done, optionally with
    // any error that was encountered while doing the work.
    callback(error);
  });
};
```

When Firework is done processing a job it stores the job along with some metadata in the `startedJobs` child location of your queue. Thus, `pendingJobs` contains a list of all jobs that still need to be done and `startedJobs` contains a list of all jobs that you have attempted.

### Retrying Failed Jobs

If a job fails, it will have `_failedAt` and `_error` properties. You can use the `_error` property to determine the reason of the failure. Once you've fixed the problem, you can retry all jobs that failed using:

```js
queue.retryFailedJobs();
```

### Installation

You can install Firework using [npm](https://www.npmjs.org/):

```sh
$ npm install firework
```

### Specs

To run the specs in node:

    $ npm install
    $ ./scripts/run-specs

To run the specs in a browser, first run:

    $ npm install
    $ ./scripts/serve-specs

Then open [http://localhost:8080/](http://localhost:8080/) in a browser.

### License

[MIT](http://opensource.org/licenses/MIT)
