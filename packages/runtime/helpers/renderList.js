import { isNumber, isString, isObject, isArray } from '@mini-vue3/shared';

//renderList(items, (item, index) => h('div', null, item + index))
export function renderList(source, renderItem) {
  const vnodes = [];
  // item in items  array
  // item in obj  object
  // item in 10  number
  // item in 'abcde'  string
  if (isNumber(source)) {
    for (let i = 0; i < source; i++) {
      vnodes.push(renderItem(i + 1, i));
    }
  } else if (isString(source) || isArray(source)) {
    for (let i = 0; i < source.length; i++) {
      vnodes.push(renderItem(source[i], i));
    }
  } else if (isObject(source)) {
    const keys = Object.keys(source);
    keys.forEach((key, index) => {
      vnodes.push(renderItem(source[key], key, index));
    });
  }
  return vnodes;
}
