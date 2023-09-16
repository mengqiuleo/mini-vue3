export function patchProps(el, oldProps, newProps) {
  if (oldProps === newProps) {
    return;
  }
  oldProps = oldProps || {};
  newProps = newProps || {};
  for (const key in newProps) {
    if (key === 'key') {
      continue;
    }
    const prev = oldProps[key];
    const next = newProps[key];
    if (prev !== next) {
      patchDomProp(el, key, prev, next);
    }
  }
  for (const key in oldProps) {
    if (key !== 'key' && !(key in newProps)) {
      patchDomProp(el, key, oldProps[key], null);
    }
  }
}

//* 建议参考霍春阳博客
const domPropsRE = /[A-Z]|^(value|checked|selected|muted|disabled)$/;
// 这个正则匹配成功，需要满足 [A-Z] 或者 ^(value|checked|selected|muted|disabled)$
// [A-Z] 是为了匹配 innerHTML 和 textContent 这两个属性
function patchDomProp(el, key, prev, next) {
  switch (key) {
    case 'class':
      // 暂时认为class就是字符串
      // next可能为null，会变成'null'，因此要设成''
      el.className = next || '';
      break;
    case 'style':
      // style为对象
      if (!next) {
        el.removeAttribute('style');
      } else {
        for (const styleName in next) {
          el.style[styleName] = next[styleName];
        }
        if (prev) {
          for (const styleName in prev) {
            if (next[styleName] == null) {
              el.style[styleName] = '';
            }
          }
        }
      }
      break;
    default:
      if (/^on[^a-z]/.test(key)) { // 以 on 开头， [^a-z] 表示不能是a-z，那么只能是大写的
        // 事件
        if (prev !== next) {
          const eventName = key.slice(2).toLowerCase();
          if (prev) {
            el.removeEventListener(eventName, prev);
          }
          if (next) {
            el.addEventListener(eventName, next);
          }
        }
      } 
      // 下面是设置 Attributes 和 DOM Properties
      else if (domPropsRE.test(key)) { //*满足这些正则的，作为 domProp 赋值
        if (next === '' && typeof el[key] === 'boolean') { // 这种情况：<input type="checkbox" checked />
          // 编译成 vnode 为: { "checked": "" }
          next = true;
          //它的值是空字符串。
          //但如果给 input 元素的 checked 直接赋值为空字符串，它实际上是赋值为 false
          //因此还要加个特殊判断
        }
        el[key] = next;
      } else { //*不满足这些正则的，使用setAttribute
        // 例如自定义属性{custom: ''}，应该用setAttribute设置为<input custom />
        // 而{custom: null}，应用removeAttribute设置为<input />
        if (next == null || next === false) {
          el.removeAttribute(key);
        } else {
          el.setAttribute(key, next);
        }
      }
      break;
  }
}
