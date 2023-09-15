import { isObject, hasChanged, isArray } from '@mini-vue3/shared';
import { track, trigger } from './effect';

const reactiveMap = new WeakMap();

// 这里没有对代码进行抽离，对应 readonly, shallowReadonly... 这些都是传入的 baseHandler 不同
export function reactive(target) {
  if (!isObject(target)) {
    return target;
  }
  if (isReactive(target)) {
    return target;
  }
  if (reactiveMap.has(target)) {
    return reactiveMap.get(target);
  }
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      if (key === '__isReactive') {
        return true;
      }
      track(target, key);
      const res = Reflect.get(target, key, receiver);
      return isObject(res) ? reactive(res) : res;
    },
    set(target, key, value, receiver) {
      const oldValue = target[key];
      const oldLength = target.length;
      const res = Reflect.set(target, key, value, receiver);
      if (hasChanged(value, oldValue)) {
        trigger(target, key);
        if (isArray(target) && target.length !== oldLength) {
          trigger(target, 'length'); //手动追踪length属性，比如effect中写到：console.log(arr.length)
        }
      }
      return res;
    },
  });
  reactiveMap.set(target, proxy);
  return proxy;
}

export function isReactive(target) {
  return !!(target && target.__isReactive);
}
