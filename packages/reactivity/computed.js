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
        if (!this._dirty) { 
          this._dirty = true;//这里是为了初始化时不要执行computed，设置lazy，那么effect函数里面的fn就不会执行
          trigger(this, 'value');
        }
      },
    });
  }
// 如果 计算属性在effect中使用，那么我们也是需要实现track和trigger的
  get value() {
    if (this._dirty) {
      this._value = this.effect(); // effect执行后返回的是执行结果
      this._dirty = false;
      track(this, 'value');//这里的track指的是 computedClass 和它对应的value，的effect(这里的effect是指包含了计算属性调用的effect)
      //验证这个track的作用：调试 能触发effect UT
      //这个track 是将 调用了计算属性的 effect 放入 computedClass 中，当原值发生变化时，调用所有的effect，包括当前的计算属性effect,那么就会调用scheduler，进行trigger
      //将 当前computedClass 的所有 effect执行
    }
    return this._value;
  }

  set value(val) {
    this._setter(val);
  }
}
