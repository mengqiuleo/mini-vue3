import { isObject, isString } from '@mini-vue3/shared';
import { isReactive } from '@mini-vue3/reactivity';

export const Text = Symbol('Text');
export const Fragment = Symbol('Fragment');

export const ShapeFlags = {
  ELEMENT: 1,
  TEXT: 1 << 1,
  FRAGMENT: 1 << 2,
  COMPONENT: 1 << 3,
  TEXT_CHILDREN: 1 << 4,
  ARRAY_CHILDREN: 1 << 5,
  CHILDREN: (1 << 4) | (1 << 5),
};

/**
 * vnode有四种类型：dom元素，纯文本，Fragment，组件
 * @param {string | Text | Fragment | Object } type
 * @param {Object | null} props
 * @param {string | array | null} children
 * @returns VNode
 */
export function h(type, props = null, children = null) {
  let shapeFlag = 0;
  if (isString(type)) {
    shapeFlag = ShapeFlags.ELEMENT;
  } else if (type === Text) {
    shapeFlag = ShapeFlags.TEXT;
  } else if (type === Fragment) {
    shapeFlag = ShapeFlags.FRAGMENT;
  } else {
    shapeFlag = ShapeFlags.COMPONENT;
  }

  if (typeof children === 'string' || typeof children === 'number') {
    shapeFlag |= ShapeFlags.TEXT_CHILDREN;
    children = children.toString();
  } else if (Array.isArray(children)) {
    shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
  }

  if (props) {
    // 其实是因为，vnode要求immutable，这里如果直接赋值的话是浅引用
    // 如果使用者复用了props的话，就不再immutable了，因此这里要复制一下。style同理
    // for reactive or proxy objects, we need to clone it to enable mutation.
    if (isReactive(props)) {
      props = Object.assign({}, props);
    }
    // reactive state objects need to be cloned since they are likely to be
    // mutated
    if (isReactive(props.style)) {
      props.style = Object.assign({}, props.style);
    }
  }

  return {
    type,
    props,
    children,
    shapeFlag,
    el: null,//当前虚拟节点对应的真实节点, 卸载时会用到
    anchor: null, // fragment专有
    key: props && (props.key != null ? props.key : null), //diff算法
    component: null, // 组件的instance
  };
}
// type如果为对象时，里面的属性可能为：
/**
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
}

这些 属性都是我们直接写入的，在createApp中
 */

// 该函数用于规整vnode，因为所有的vnode一定有一个根节点，如果用户传入的vnode不标准，我们需要整理
export function normalizeVNode(result) {
  if (Array.isArray(result)) {
    return h(Fragment, null, result);
  }
  if (isObject(result)) {
    return result;
  }
  return h(Text, null, result.toString());
}
