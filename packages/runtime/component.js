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
  instance.props = reactive(instance.props);//*响应式：实现修改props触发更新
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
    isMounted: false,
    subTree: null,
    next: null, // 组件更新时，把新vnode暂放在这里
  });

  // setupComponent: 处理props
  updateProps(instance, vnode);

  // 源码：instance.setupState = proxyRefs(setupResult)
  instance.setupState = Component.setup?.(instance.props, {
    attrs: instance.attrs,
  });

  instance.ctx = {
    ...instance.props,
    ...instance.setupState,//这里面有props
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

  // setupRenderEffect
  instance.update = effect(
    () => {
      if (!instance.isMounted) {
        // mount
        const subTree = (instance.subTree = normalizeVNode(
          Component.render(instance.ctx)
        ));

        fallThrough(instance, subTree);

        patch(null, subTree, container, anchor);
        instance.isMounted = true;
        vnode.el = subTree.el;
      } else {
        // update

        // instance.next存在，代表是被动更新。否则是主动更新
        if (instance.next) {
          vnode = instance.next;
          instance.next = null;
          updateProps(instance, vnode);
          instance.ctx = {
            ...instance.props,
            ...instance.setupState,
          };
        }

        const prev = instance.subTree;
        const subTree = (instance.subTree = normalizeVNode(
          Component.render(instance.ctx)
        ));

        fallThrough(instance, subTree);

        patch(prev, subTree, container, anchor);
        vnode.el = subTree.el;
      }
    },
    {
      scheduler(){
        queueJob(instance.update)
      }
    }
  );
}

export function registerRuntimeCompiler(_compile) {
  compile = _compile;
}