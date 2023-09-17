import { render } from './render';
import { isFunction, camelize, capitalize } from '@mini-vue3/shared';
import { h } from './vnode';

let components;
export function createApp(rootComponent) {
  components = rootComponent.components || {};
  const app = {
    mount(rootContainer) {
      if (typeof rootContainer === 'string') {
        rootContainer = document.querySelector(rootContainer);
      }

      if (!isFunction(rootComponent.render) && !rootComponent.template) {
        rootComponent.template = rootContainer.innerHTML;
      }
      rootContainer.innerHTML = '';

      //当调用 mount 时，我们需要挂载
      render(h(rootComponent), rootContainer); // render(vnode, container)  
      // h(type, props = null, children = null) type为对象时表示组件  h函数等价于createVNode
      // 对于下面的案例，我们传入了对象，那么shapeFlag会被判断为object，然后剩下的属性值为空
    },
  };
  return app;
}
/** demo
createApp({
  setup() {
    const count = ref(0);
    const add = () => count.value++;
    return {
      count,
      add,
    };
  },
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
  template:`{{ msg }} {{ name }}`,
  props: ['name']
}).mount('#app');

createApp中传入的对象会被转换为 vnode, 然后通过render函数渲染
vnode demo:
{
  type: {
    template:`{{ msg }} {{ name }}`,
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
    props: ['name'], //内部对该属性声明
    setup(){
      return {
        msg: 'hello'
      }
    }
  },
  props: { name: 'world' }, //组件外部传入属性值
  children: []
}
 */

export function resolveComponent(name) {
  return (
    components &&
    (components[name] ||
      components[camelize(name)] ||
      components[capitalize(camelize(name))])
  );
}
