const queue = [];
let isFlushing = false;
const resolvedPromise = Promise.resolve();
let currentFlushPromise = null;

export function nextTick(fn) {
  // nextTick 什么时候执行呢？应该在当前 flushJobs 执行之后再执行，
  // 即： resolvedPromise.then(flushJobs).then(fn)
  const p = currentFlushPromise || resolvedPromise;
  return fn ? p.then(fn) : p;
}

export function queueJob(job) {
  if (!queue.length || !queue.includes(job)) {
    queue.push(job); //每次放入任务后，都需要刷新队列，即开启这次的更新，并且要判断当前是否正在刷新中，如果正在刷新，那就不做任何处理，通过一个变量控制
    queueFlush(); //触发清空队列的操作
  }
}

function queueFlush() { //
  if (!isFlushing) {
    isFlushing = true;
    currentFlushPromise = resolvedPromise.then(flushJobs); //刷新操作就是取出所有的job执行，在then函数中，我们需要对已经执行过的job去除
  }
}

function flushJobs() { //执行当前这次刷新的所有jobs
  try {
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i];
      job();
    }
  } finally {
    isFlushing = false;
    queue.length = 0;
    currentFlushPromise = null;
  }
}
