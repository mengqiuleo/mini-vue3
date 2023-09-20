import { ElementTypes, NodeTypes } from './ast';
import { capitalize } from '@mini-vue3/shared';

export function generate(ast) {
  const returns = traverseNode(ast);
  const code = `
with (ctx) {
    const { h, Text, Fragment, renderList, resolveComponent, withModel } = MiniVue
    return ${returns}
}`;
  return code;
}

export function traverseNode(node, parent) {
  switch (node.type) {
    case NodeTypes.ROOT:
      if (node.children.length === 1) {
        return traverseNode(node.children[0], node);
      }
      const result = traverseChildren(node); //多子节点的情况：<div>hi, {{age}}</div>, 两个子节点，文本和插值
      return node.children.length > 1 ? `[${result}]` : result;
    case NodeTypes.ELEMENT:
      return resolveElementASTNode(node, parent); //<div/> -> h('div')
    case NodeTypes.TEXT: //hi mini-vue  -> h(Text, null, 'hi mini-vue)
      return createTextVNode(node);
    case NodeTypes.INTERPOLATION://{{name}} => h(Text, null, name)
      return createTextVNode(node.content);
  }
}

function traverseChildren(node) {
  const { children } = node;

  if (children.length === 1) { //如果只有一个孩子
    const child = children[0];
    if (child.type === NodeTypes.TEXT) { //孩子为文本节点
      return createText(child);
    }
    if (child.type === NodeTypes.INTERPOLATION) { //孩子为插值节点
      return createText(child.content);
    }
  }

  const results = [];
  for (let i = 0; i < children.length; i++) { //多个子节点
    const child = children[i];
    results.push(traverseNode(child, node));
  }

  return results.join(', ');
}

// 这里parent是必然存在的
function resolveElementASTNode(node, parent) { //专门处理特殊指令
  const ifNode = //是否存在 v-if 或者 v-else-if
    pluck(node.directives, 'if') || pluck(node.directives, 'else-if');

  //* 好恶心，看不懂，感觉为了解析而解析，先跳过吧！！！
  if (ifNode) { //<h1 v-if="ok"></h1> <h2 v-else></h2>  ->   ok ? h("h1") : h("h2")
    // 递归必须用resolveElementASTNode，因为一个元素可能有多个指令
    // 所以处理指令时，移除当下指令也是必须的
    const consequent = resolveElementASTNode(node, parent); //<h1></h1> : h('h1')
    let alternate; //<h2></h2>: h('h2')

    // 如果有ifNode，则需要看它的下一个元素节点是否有else-if或else
    const { children } = parent;
    let i = children.findIndex((child) => child === node) + 1;
    for (; i < children.length; i++) {
      const sibling = children[i];

      // <div v-if="ok"/> <p v-else-if="no"/> <span v-else/>
      // 为了处理上面的例子，需要将空节点删除
      // 也因此，才需要用上for循环
      if (sibling.type === NodeTypes.TEXT && !sibling.content.trim()) {
        children.splice(i, 1);
        i--;
        continue;
      }

      if (
        sibling.type === NodeTypes.ELEMENT &&
        (pluck(sibling.directives, 'else') ||
          // else-if 既是上一个条件语句的 alternate，又是新语句的 condition
          // 因此pluck时不删除指令，下一次循环时当作ifNode处理
          pluck(sibling.directives, 'else-if', false))
      ) {
        alternate = resolveElementASTNode(sibling, parent);
        children.splice(i, 1);
      }
      // 只用向前寻找一个相临的元素，因此for循环到这里可以立即退出
      break;
    }

    const { exp } = ifNode; // exp.content: ok
    return `${exp.content} ? ${consequent} : ${alternate || createTextVNode()}`;
  }

  //<div v-for="(item, index) in items">{{item + index}}</div>
  const forNode = pluck(node.directives, 'for'); //检测 v-for 指令
  if (forNode) { // forNode 是 (item, index) in items
    const { exp } = forNode;
    const [args, source] = exp.content.split(/\sin\s|\sof\s/); // args: (item, index)  source: items
    // renderList(items, (item, index) => h('div', null, item + index))
    return `h(Fragment, null, renderList(${source.trim()}, ${args.trim()} => ${resolveElementASTNode(
      node
    )}))`;
  }

  return createElementVNode(node);
}

function createElementVNode(node) {
  const { children, directives } = node;

  const tag =
    node.tagType === ElementTypes.ELEMENT //元素/组件
      ? `"${node.tag}"`
      : `resolveComponent("${node.tag}")`;

  const propArr = createPropArr(node); //属性
  let propStr = propArr.length ? `{ ${propArr.join(', ')} }` : 'null';//多个属性要加 ,

  // 处理 v-model
  const vModel = pluck(directives, 'model');
  if (vModel) {
    const getter = `() => ${createText(vModel.exp)}`;
    const setter = `value => ${createText(vModel.exp)} = value`;
    propStr = `withModel(${tag}, ${propStr}, ${getter}, ${setter})`;
  }

  if (!children.length) { //如果没有孩子，返回的格式要不同，下面的返回是有孩子的
    if (propStr === 'null') {
      return `h(${tag})`;
    }
    return `h(${tag}, ${propStr})`;
  }

  let childrenStr = traverseChildren(node); //处理孩子
  if (children[0].type === NodeTypes.ELEMENT) {
    childrenStr = `[${childrenStr}]`;
  }
  return `h(${tag}, ${propStr}, ${childrenStr})`; 
  //<div id='foo' class='bar' @click='handleClick'></div>  ->  h('div', {id:'foo',class:'bar',onClick: handleClick})
}

function createPropArr(node) { //解析属性
  const { props, directives } = node;
  return [
    ...props.map((prop) => `${prop.name}: ${createText(prop.value)}`),//属性
    ...directives.map((dir) => {
      const content = dir.arg?.content; //对应的函数 
      switch (dir.name) { //指令名称
        case 'bind':
          return `${content}: ${createText(dir.exp)}`;
        case 'on':
          const eventName = `on${capitalize(content)}`;//驼峰
          let exp = dir.exp.content;

          // 以括号结尾，并且不含'=>'的情况，如 @click="foo()"
          // 当然，判断很不严谨，比如不支持 @click="i++"
          // 首先有 ( 和 )， ( 和 ) 之间匹配 [^)]*?
          //匹配：除了 ) 之外的任意一个字符     *?：重复任意次，但尽可能少重复
          if (/\([^)]*?\)$/.test(exp) && !exp.includes('=>')) {
            exp = `$event => (${exp})`;
          }
          //上面的正则所代表的的情况：
          //<div @click='foo($event,123,foo)' @mouseup='bar' />   转换成   h('div', {onClick: ($event) => foo($event, 123, foo), onMouseup: bar})
          return `${eventName}: ${exp}`; //onClick: handleClick
        case 'html':
          return `innerHTML: ${createText(dir.exp)}`;
        default:
          return `${dir.name}: ${createText(dir.exp)}`;
      }
    }),
  ];
}

// 可以不remove吗？不可以
function pluck(directives, name, remove = true) { //工具函数：判断是否存在 某种指令：pluck(node.directives, 'for')   pluck(node.directives, 'else-if') 
  const index = directives.findIndex((dir) => dir.name === name);
  const dir = directives[index];
  if (remove && index > -1) {
    directives.splice(index, 1);
  }
  return dir;
}

// node只接收text和simpleExpresstion
function createTextVNode(node) {
  const child = createText(node);
  return `h(Text, null, ${child})`;
}

function createText({ content = '', isStatic = true } = {}) {
  return isStatic ? JSON.stringify(content) : content; //这样可以实现加引号
}
