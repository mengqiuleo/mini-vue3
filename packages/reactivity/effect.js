import { extend } from "@mini-vue3/shared"

let activeEffect
const effectStack = []

export class ReactiveEffect{ //* 一种封装的思想
  constructor(fn, scheduler = null){
    this._fn = fn
    this.scheduler = scheduler
    this.deps = []
    this.active = true //控制stop是否已经清理过, true表示还没clean
    this.opStop = () => {}
  }

  run(){
    effectStack.push(this)
    activeEffect = this
    if(!this.active){ //false:已经clean过了，以后不用追踪
      return this._fn()
    }

    const result = this._fn() //在这里执行 effect的时候，触发track/trigger，那么就能保证 activeEffect 是当前this，执行之后重置

    effectStack.pop()
    activeEffect = effectStack[effectStack.length-1] //解决 effect嵌套的问题
    return result
  }

  stop(){
    //频繁调用 stop 时，如果清空过了，就不用再清空了
    if(this.active){
      cleanupEffect(this)
      if(this.onStop){
        this.onStop()
      }
      this.active = false
    }
  }
}

export function effect(fn, options = {}){
  const _effect = new ReactiveEffect(fn)

  if(!options.lazy){ //lazy针对 计算属性
    _effect.run()
  }

  _effect.scheduler = options.scheduler

  const runner =  _effect.run.bind(_effect) // 返回的那个runner函数
  runner.effect = _effect
  return runner

}

export function stop(runner){
  runner.effect.stop()
}

function cleanupEffect(effect){
  effect.deps.forEach((dep) => { //dep代表某个key的所有effect，是一个set
    dep.delete(effect) //让每一个set删除当前effect
  })
  effect.deps.length = 0
}

const targetMap = new Map() //所有对象，映射
export function track(target, key){
  if(!activeEffect) return

  // 每一个 target 的每一个属性都要存，容器 Set
  // target -> key -> dep
  let depsMap = targetMap.get(target)
  if(!depsMap){
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }
  let dep = depsMap.get(key) //dep: 对应的多个更新函数， 一个属性牵连着多个更新函数
  if(!dep){
    dep = new Set()
    depsMap.set(key, dep)
  }

  // trackEffects(dep)
  // 这里可以不用判断 activeEffect是否已经在dep中了，因为 dep 是一个set
  dep.add(activeEffect)
}

export function trackEffects(dep){
  //如果activeEffect已经在dep中了，不用再加了
  if(!dep.has(activeEffect)){
    dep.add(activeEffect) //将当前的更新函数保存，如何拿到当前effect中的fn, 利用全局变量
    activeEffect.deps.push(dep) //* 互相收集，当前effect收集它的 dep，这个是在stop 中使用的，而目前我们不考虑使用这个
  }
}

export function trigger(target, key){
  let depsMap = targetMap.get(target)
  if(!depsMap) return
  let dep = depsMap.get(key)

  if(!dep) return
  // triggerEffects(dep)
  dep.forEach((effect) => {
    if (effect.scheduler) {
      effect.scheduler();
    } else {
      effect.run()
    }
  })
}

// export function triggerEffects(dep){
//   for(const effect of dep){ //每一个effect都是一个 class类实例
//     if(effect.scheduler){
//       effect.scheduler()
//     } else {
//       effect.run()
//     }
//   }
// }

