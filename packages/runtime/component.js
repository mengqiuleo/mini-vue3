import { reactive, effect } from '@mini-vue3/reactivity';
import { normalizeVNode } from './vnode';
import { queueJob } from './scheduler';
// import { compile } from '../compiler/index';
let compile;
function updateProps(instance, vnode) { //处理props
  const { type: Component, props: vnodeProps } = vnode;
  const props = (instance.props = {});
  const attrs = (instance.attrs = {});
  for (const key in vnodeProps) {
    if (Component.props?.includes(key)) {
      props[key] = vnodeProps[key];
    } else {
      attrs[key] = vnodeProps[key];
    }
  }
  // toThink: props源码是shallowReactive，确实需要吗?
  // 需要。否则子组件修改props不会触发更新
  instance.props = reactive(instance.props);//*响应式：实现修改props触发更新！！！
}

function fallThrough(instance, subTree) {
  if (Object.keys(instance.attrs).length) {
    subTree.props = {
      ...subTree.props,
      ...instance.attrs,
    };
  }
}

export function mountComponent(vnode, container, anchor, patch) {
  const { type: Component } = vnode;

  // createComponentInstance: 创建组件实例
  const instance = (vnode.component = {
    props: {},//* props VS attrs
    attrs: {},
    setupState: null,
    ctx: null,
    update: null,
    isMounted: false, //组件是否挂载过
    subTree: null, //组件应该变成的vnode
    slots: {},
    next: null, // 组件更新时，把新vnode暂放在这里
  });

  // setupComponent: 处理props，将需要的数据解析到instance实例上
  updateProps(instance, vnode); //主要是分割 props 和 attrs 

  // 源码：instance.setupState = proxyRefs(setupResult)
  instance.setupState = Component.setup?.(instance.props, {
    attrs: instance.attrs,
  });

  instance.ctx = { //把ctx当做参数传入effect函数，在effect中调用ctx.count，就相当于effect中的值调用，因此render函数就相当于effect
    ...instance.props,
    ...instance.setupState,
  };

  if (!Component.render && Component.template) {
    let { template } = Component;
    if (template[0] === '#') {
      const el = document.querySelector(template);
      template = el ? el.innerHTML : '';
    }
    //* 注意，这里是和 compiler 的结合 ！！！！！！
    Component.render =  new Function('ctx', compile(template));
  }

  //* 组件的 render 一定是一个 effect 函数，数据变化会重新渲染 
  // setupRenderEffect
  instance.update = effect( //每个组件都有一个effect
    () => {
      if (!instance.isMounted) { //没有被挂载，初次渲染
        // mount
        const subTree = (instance.subTree = normalizeVNode( //subTree是vnode
          Component.render(instance.ctx)
        ));
        //注意区分组件的render方法和源码里面的render方法
        //组件的render方法：功能等同于template：返回的是vnode
        //源码里的render方法：将vnode挂载到页面上

        fallThrough(instance, subTree); //整合props，好像是因为会继承

        patch(null, subTree, container, anchor); //对组件的子元素处理
        instance.isMounted = true;
        vnode.el = subTree.el;
      } else {
        // update

        // instance.next存在，代表是被动更新。否则是主动更新
        //被动更新：父组件传给子组件的props发生改变，那么子组件也会更新，这里的子组件更新就是被动更新
        // 即 updateComponent 函数
        if (instance.next) {
          vnode = instance.next; //即n2
          instance.next = null;
          updateProps(instance, vnode);
          instance.ctx = {
            ...instance.props,
            ...instance.setupState,
          };
        }

        const prev = instance.subTree; //旧的树 的 vnode
        const subTree = (instance.subTree = normalizeVNode( //新的树的vnode
          Component.render(instance.ctx)  //normalizeVNode函数用来规整vnode，比如用户传入了一个vnode数组，但是正确的vnode是最外层有一个根节点
        ));

        fallThrough(instance, subTree);

        patch(prev, subTree, container, anchor); //对比两棵树的vnode差异：diff算法
        vnode.el = subTree.el;
      }
    },
    {
      scheduler(){ //当我们传入了调度器，第一次会执行effect，之后就会执行调度器
        queueJob(instance.update) //当需要更新时，我们不立即更新，而是将这个更新放入queue
      }
    }
  );
}

export function registerRuntimeCompiler(_compile) {
  compile = _compile;
}

// 如何结合 响应式
/**
render(ctx) {
  return [
    h('div', null, ctx.count),
    h(
      'button',
      {
        onClick: ctx.add,
      },
      'add'
    ),
  ];
},

我们首先将 instance.props = reactive(instance.props) 
对于 effect，首先明确两点，
1. 组件的 render 一定是一个 effect 函数，数据变化会重新渲染 
2. effect中需要调用响应式的属性值
对于render函数中，我们传入ctx参数，ctx其实
instance.ctx = {
    ...instance.props,
    ...instance.setupState,//这里面有props
  }
并且在 render函数中，我们通过 ctx.count 调用属性，这样属性就会收集当前effect，即当前render函数

本来render里面是进行了proxy代理的，我们这里简化了
 */