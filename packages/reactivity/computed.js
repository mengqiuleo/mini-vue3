import { isFunction } from '@mini-vue3/shared';
import { track, trigger, effect } from './effect';
/**
 * 关于 computed，我竟然有些不太懂
 * 接受一个 getter 函数，返回一个只读的响应式 ref 对象。
 * 该 ref 通过 .value 暴露 getter 函数的返回值。
 * 它也可以接受一个带有 get 和 set 函数的对象来创建一个可写的 ref 对象。
 * https://cn.vuejs.org/api/reactivity-core.html#computed
 */
/**
 * 关键点在于，当我们计算属性包裹的响应式的值发生改变时，computed如何监听到
 * effect 第一次执行的时候会执行 fn，不会执行 scheduler
 * 当响应式对象 set update 如果有scheduler, 此时不会执行 fn, 而是执行 scheduler
 */
export function computed(getterOrOptions) {
  let getter, setter;
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions;
    setter = () => {
      console.warn('Write operation failed: computed value is readonly');
    };
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }

  return new ComputedRefImpl(getter, setter);
}

class ComputedRefImpl {
  constructor(getter, setter) {
    this._setter = setter;
    this._value = undefined;
    this._dirty = true; //值是否发生改变，true表示发生改变，初始化时也算一次改变
    this.effect = effect(getter, {
      lazy: true,
      scheduler: () => {
        if (!this._dirty) { //如果以前标记值未发生改变，那么此时标记为值发生改变，那么下一次我们获取计算属性值时，就是执行effect的fn，那么此时就会触发get，走 Reflect.get
          this._dirty = true;
          trigger(this, 'value');//响应式值变化，执行所有包含计算属性的effect
        }
      },
    });
  }

  /**
   * 这里需要分成：初始化，第一次调用，第二次调用 
   * 初始化：要求不执行，刚开始不会走下面的 get 函数，下面的 get 函数是在获取值的时候才走  在effect中设置了lazy，所以不执行，
   * 第一次get调用：dirty=true，调用 effect，这是effect首次执行，那么执行fn，获取值，dirty=false
   * 当响应式值发生变化时，它对应的effect触发，而这个effect中包含这个computedEffect,而这个computedEffect是执行scheduler的，此时就会标记dirty=true，
   * 当我们第二次调用get时，此时值发生变化，dirty=true
   */
  get value() {
    if (this._dirty) {
      this._value = this.effect(); 
      this._dirty = false;
      track(this, 'value');//这里的track指的是 computedClass 和它对应的value，的effect(这里的effect是指包含了计算属性调用的effect)
    }
    return this._value;
  }

  // 当 set 时， 我们执行的是 scheduler
  set value(val) {
    this._setter(val);
  }
}
