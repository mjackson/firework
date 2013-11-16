Firework is a distributed, fault-tolerant work queue for Firebase.

### Usage

The easiest way to start processing the jobs on a Firework queue is to use the `firework` command:

```sh
$ firework -q https://my-firebase.firebaseio.com/my-queue -m ./process-job.js
```

A Firework queue stores all of its jobs under a single Firebase location reference, designated by the `-q` option. The `-m` option specifies the path to a module file that exports a function you use to process jobs. It should look like this:

```js
module.exports = function (job, callback) {
  doSomeWork(job, function (error, result) {
    // log/check the result, etc.
    callback(error);
  });
};
```

The `job` argument should be a plain JavaScript object that contains the data you need to do the necessary work. You can add jobs to the queue by `push()`ing onto the `pendingJobs` ref directly underneath the primary ref you're using for the queue, e.g.:

```js
var queueRef = new Firebase('https://my-firebase.firebaseio.com/my-queue');
queueRef.child('pendingJobs').push({ my: 'job' });
```

Workers pull from the *beginning* of the queue (FIFO). If you have jobs of varying importance you can use a [priority](https://www.firebase.com/docs/ordered-data.html) to run some jobs before others.

```js
var pendingJobs = queueRef.child('pendingJobs');
pendingJobs.push().setWithPriority({ important: 'job' }, 0);
pendingJobs.push().setWithPriority({ less: 'important' }, 100);
```
