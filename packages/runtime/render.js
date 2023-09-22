import { ShapeFlags } from './vnode';
import { patchProps } from './patchProps';
import { mountComponent } from './component';

export function render(vnode, container) {
  const prevVNode = container._vnode;
  if (!vnode) {
    if (prevVNode) {
      unmount(prevVNode);
    }
  } else {
    patch(prevVNode, vnode, container);
  }
  container._vnode = vnode;
}

//parentNode.insertBefore(newNode, referenceNode);
/**
parentNode 是要将新元素插入到其子节点中的父节点，newNode 是要插入的新节点，referenceNode 是已存在于父节点中的某个子节点。
插入操作将在 referenceNode 之前插入 newNode。
referenceNode如果未规定，则 insertBefore 方法会在结尾插入 newNode
 */

// n1可能为null，n2不可能为null
function patch(n1, n2, container, anchor) { // anchor 是 原来位置上的下一个节点，我们统一采用 insertBefore 插入节点
  if (n1 && !isSameVNodeType(n1, n2)) { //n1 n2 类型不同，n1卸载
    // n1被卸载后，n2将会创建，因此anchor至关重要。需要将它设置为n1的下一个兄弟节点
    anchor = (n1.anchor || n1.el).nextSibling;
    unmount(n1);
    n1 = null;
  }

  const { shapeFlag } = n2;
  if (shapeFlag & ShapeFlags.ELEMENT) {
    processElement(n1, n2, container, anchor);
  } else if (shapeFlag & ShapeFlags.TEXT) {
    processText(n1, n2, container, anchor);
  } else if (shapeFlag & ShapeFlags.FRAGMENT) {
    processFragment(n1, n2, container, anchor);
  } else if (shapeFlag & ShapeFlags.COMPONENT) {
    processComponent(n1, n2, container, anchor);
  }
}

function mountElement(vnode, container, anchor) {
  const { type, props, shapeFlag, children } = vnode;
  const el = document.createElement(type);

  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    el.textContent = children;
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    // 这里不能传anchor。因为anchor限制的是当前的element
    // 作为本element的children，不用指定anchor，append就行
    mountChildren(children, el);
  }

  if (props) {
    //* 挂载元素需要三个操作: 挂载元素，处理props，处理children
    patchProps(el, null, props);
  }

  vnode.el = el; //保存虚拟节点的真实dom位置
  container.insertBefore(el, anchor);
}

function mountTextNode(vnode, container, anchor) {
  const textNode = document.createTextNode(vnode.children);
  vnode.el = textNode;
  container.insertBefore(textNode, anchor);
}

function mountChildren(children, container, anchor) {
  children.forEach((child) => {
    patch(null, child, container, anchor);
  });
}

function updateComponent(n1, n2) {
  n2.component = n1.component;
  n2.component.next = n2; //instance.next存在，代表是被动更新。否则是主动更新
  //这里设置next，在 update(effect)中会使用
  n2.component.update(); //被动更新
}

function unmount(vnode) {
  const { shapeFlag, el } = vnode; //el是当前节点对应的真实dom
  if (shapeFlag & ShapeFlags.COMPONENT) {
    unmountComponent(vnode);
  } else if (shapeFlag & ShapeFlags.FRAGMENT) {
    unmountFragment(vnode);
  } else {
    el.parentNode.removeChild(el);
  }
}

function unmountComponent(vnode) {
  const { component } = vnode;
  unmount(component.subTree);
}

function unmountFragment(vnode) {
  let { el: cur, anchor: end } = vnode;
  while (cur !== end) {
    const next = cur.nextSibling;
    cur.parentNode.removeChild(cur);
    cur = next;
  }
  end.parentNode.removeChild(end);
}

function isSameVNodeType(n1, n2) {
  return n1.type === n2.type;
}

function processElement(n1, n2, container, anchor) {
  if (n1 == null) {
    mountElement(n2, container, anchor);
  } else {
    patchElement(n1, n2);
  }
}

function processFragment(n1, n2, container, anchor) {
  const fragmentStartAnchor = (n2.el = n1
    ? n1.el
    : document.createTextNode(''));
  const fragmentEndAnchor = (n2.anchor = n1
    ? n1.anchor
    : document.createTextNode(''));
  if (n1 == null) {
    container.insertBefore(fragmentStartAnchor, anchor);
    container.insertBefore(fragmentEndAnchor, anchor);
    mountChildren(n2.children, container, fragmentEndAnchor);
  } else {
    patchChildren(n1, n2, container, fragmentEndAnchor);
  }
}

function processText(n1, n2, container, anchor) {
  if (n1 == null) {
    mountTextNode(n2, container, anchor);
  } else {
    n2.el = n1.el;
    n2.el.textContent = n2.children;
  }
}

function processComponent(n1, n2, container, anchor) {
  if (n1 == null) {
    mountComponent(n2, container, anchor, patch);
  } else {
    updateComponent(n1, n2);
  }
}

function patchElement(n1, n2) {
  n2.el = n1.el;
  patchProps(n2.el, n1.props, n2.props);
  patchChildren(n1, n2, n2.el);
}

function patchChildren(n1, n2, container, anchor) {
  const { shapeFlag: prevShapeFlag, children: c1 } = n1;
  const { shapeFlag, children: c2 } = n2;

  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) { 
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) { //n1：数组，n2: 文本，卸载n1
      unmountChildren(c1);
    }
    if (c2 !== c1) {
      container.textContent = c2;
    }
  } else {
    // c2 is array or null
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // c1 was array
      if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // c2 is array
        // 简单认为头一个元素有key就都有key 
        //* DIFF 算法！！！
        if (c1[0] && c1[0].key != null && c2[0] && c2[0].key != null) {
          patchKeyedChildren(c1, c2, container, anchor);
        } else {
          patchUnkeyedChildren(c1, c2, container, anchor); //处理没有 key 的情况
        }
      } else {
        // c2 is null
        unmountChildren(c1);
      }
    } else {
      // c1 was text or null
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        container.textContent = '';
      }
      if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        mountChildren(c2, container, anchor);
      }
    }
  }
}

function unmountChildren(children) {
  children.forEach((child) => unmount(child));
}

function patchUnkeyedChildren(c1, c2, container, anchor) {
  // 对于没有key 的情况，直接暴力比对，一一比对，不一样的话，删除旧的，挂载新的
  const oldLength = c1.length;
  const newLength = c2.length;
  const commonLength = Math.min(oldLength, newLength);
  for (let i = 0; i < commonLength; i++) {
    patch(c1[i], c2[i], container, anchor);
  }
  if (newLength > oldLength) {
    mountChildren(c2.slice(commonLength), container, anchor);
  } else if (newLength < oldLength) {
    unmountChildren(c1.slice(commonLength));
  }
}

function patchKeyedChildren(c1, c2, container, anchor) {
  let i = 0,
    e1 = c1.length - 1,
    e2 = c2.length - 1;
  // 1.从左至右依次比对
  // key的判断可能要换成isSameVNodetype
  while (i <= e1 && i <= e2 && c1[i].key === c2[i].key) {
    patch(c1[i], c2[i], container, anchor);
    i++;
  }

  // 2.从右至左依次比对
  while (i <= e1 && i <= e2 && c1[e1].key === c2[e2].key) {
    patch(c1[e1], c2[e2], container, anchor);
    e1--;
    e2--;
  }

  if (i > e1) { //新节点mount
    //* 这里对应的是笔记的那两幅图：插入和删除
    // 3.经过1、2直接将旧结点比对完，则剩下的新结点直接mount
    const nextPos = e2 + 1;
    const curAnchor = (c2[nextPos] && c2[nextPos].el) || anchor;
    for (let j = i; j <= e2; j++) {
      patch(null, c2[j], container, curAnchor);
    }
  } else if (i > e2) { //旧结点卸载
    // 3.经过1、2直接将新结点比对完，则剩下的旧结点直接unmount
    for (let j = i; j <= e1; j++) {
      unmount(c1[j]);
    }
  } else {
    // 4.采用传统diff算法，但不真的添加和移动，只做标记和删除
    const map = new Map(); //尽可能复用
    for (let j = i; j <= e1; j++) {
      const prev = c1[j];
      map.set(prev.key, { prev, j }); //拿旧结点做映射表，因为要看是否有旧结点可以复用
    }
    // used to track whether any node has moved
    let maxNewIndexSoFar = 0;
    let move = false;
    const toMounted = [];
    const source = new Array(e2 - i + 1).fill(-1); //i是source的起点，终点是e2
    for (let k = 0; k < e2 - i + 1; k++) { //在新节点中找
      const next = c2[k + i];
      if (map.has(next.key)) { //找到了
        const { prev, j } = map.get(next.key);
        patch(prev, next, container, anchor);
        if (j < maxNewIndexSoFar) {
          move = true;
        } else {
          maxNewIndexSoFar = j;
        }
        source[k] = j;
        map.delete(next.key);
      } else {
        // 将待新添加的节点放入toMounted
        toMounted.push(k + i);
      }
    }

    // 先刪除多余旧节点
    map.forEach(({ prev }) => {
      unmount(prev);
    });

    if (move) {
      // 5.需要移动，则采用新的最长上升子序列算法
      const seq = getSequence(source);
      let j = seq.length - 1;
      for (let k = source.length - 1; k >= 0; k--) {  //source数组从后往前遍历
        if (k === seq[j]) {
          // 不用移动
          j--;
        } else {
          const pos = k + i; //i是source数组的起点，加上source数组当前的位置，这样就能找到我们现在需要操作的节点（c2[pos]）
          const nextPos = pos + 1;
          const curAnchor = (c2[nextPos] && c2[nextPos].el) || anchor;
          if (source[k] === -1) {
            // mount
            patch(null, c2[pos], container, curAnchor);
          } else {
            // 移动
            container.insertBefore(c2[pos].el, curAnchor);
          }
        }
      }
    } else if (toMounted.length) {
      // 6.不需要移动，但还有未添加的元素
      for (let k = toMounted.length - 1; k >= 0; k--) {
        const pos = toMounted[k];
        const nextPos = pos + 1;
        const curAnchor = (c2[nextPos] && c2[nextPos].el) || anchor;
        patch(null, c2[pos], container, curAnchor);
      }
    }
  }
}

function getSequence(nums) {
  const result = [];
  const position = [];
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] === -1) {
      continue;
    }
    // result[result.length - 1]可能为undefined，此时nums[i] > undefined为false
    if (nums[i] > result[result.length - 1]) {
      result.push(nums[i]);
      position.push(result.length - 1);
    } else {
      let l = 0,
        r = result.length - 1;
      while (l <= r) {
        const mid = ~~((l + r) / 2);
        if (nums[i] > result[mid]) {
          l = mid + 1;
        } else if (nums[i] < result[mid]) {
          r = mid - 1;
        } else {
          l = mid;
          break;
        }
      }
      result[l] = nums[i];
      position.push(l);
    }
  }
  let cur = result.length - 1;
  // 这里复用了result，它本身已经没用了
  for (let i = position.length - 1; i >= 0 && cur >= 0; i--) {
    if (position[i] === cur) {
      result[cur--] = i;
    }
  }
  return result;
}
