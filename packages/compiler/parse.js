import { camelize } from '@mini-vue3/shared';
import { NodeTypes, createRoot, ElementTypes } from './ast';
import { isVoidTag, isNativeTag } from './index';

export function parse(content) {
  const context = createParserContext(content); //对模板进行包装，即对数据格式进行处理
  return createRoot(parseChildren(context));
}

function createParserContext(content) {
  return {
    options: {
      delimiters: ['{{', '}}'],
      isVoidTag,
      isNativeTag,
    },
    source: content,
  };
}

function parseChildren(context) {
  const nodes = [];

  while (!isEnd(context)) {
    const s = context.source;
    let node;
    if (s.startsWith(context.options.delimiters[0])) {
      // '{{'
      node = parseInterpolation(context); //插值节点 {{name}}
    } else if (s[0] === '<') {
      node = parseElement(context); //元素节点
    } else {
      node = parseText(context);
    }
    nodes.push(node);
  }

  let removedWhitespace = false; //是否移除空白符
  for (let i = 0; i < nodes.length; i++) { //这里是处理空格符，属于特殊情况，可忽略
    const node = nodes[i];
    if (node.type === NodeTypes.TEXT) {
      // 全是空白的节点
      if (!/[^\t\r\n\f ]/.test(node.content)) {
        const prev = nodes[i - 1];
        const next = nodes[i + 1];
        if (
          !prev ||
          !next ||
          (prev.type === NodeTypes.ELEMENT &&
            next.type === NodeTypes.ELEMENT &&
            /[\r\n]/.test(node.content))
        ) {
          removedWhitespace = true;
          nodes[i] = null;
        } else {
          // Otherwise, the whitespace is condensed into a single space
          node.content = ' ';
        }
      } else {
        node.content = node.content.replace(/[\t\r\n\f ]+/g, ' ');
      }
    }
  }

  //const nodes = [0, 1, '', 'hello', null, undefined, false, true];
  //使用 nodes.filter(Boolean) 之后，将过滤掉所有的假值元素（例如 0、''、null、undefined 和 false），
  //返回的新数组将只包含真值元素（例如 1、'hello' 和 true）
  return removedWhitespace ? nodes.filter(Boolean) : nodes;
}

function isEnd(context) {
  const s = context.source;
  return s.startsWith('</') || !s;
}

function parseInterpolation(context) { //{{name}}
  const [open, close] = context.options.delimiters; // {{  }}

  advanceBy(context, open.length); //吃掉 {{
  const closeIndex = context.source.indexOf(close);

  const content = parseTextData(context, closeIndex).trim(); //name
  advanceBy(context, close.length); //吃掉 }}

  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      isStatic: false,
      content,
    },
  };
}

function advanceBy(context, numberOfCharacters) { //吃掉几个字符
  const { source } = context;
  context.source = source.slice(numberOfCharacters);
}

// 没有trim
function parseTextData(context, length) {
  const rawText = context.source.slice(0, length);
  advanceBy(context, length);
  return rawText;
}

// 不支持文本节点中带有'<'符号
function parseText(context) { //解析文本
  //文本的结束位置：{{  或者 </
  const endTokens = ['<', context.options.delimiters[0]];//右边结束位置，</ {{ 或者文本最末尾，谁下标最小取谁

  // 寻找text最近的endIndex。因为遇到'<'或'{{'都可能结束
  let endIndex = context.source.length;
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1);
    if (index !== -1 && endIndex > index) {
      endIndex = index;
    }
  }
  // endIndex 就是当前文本的末尾
  const content = parseTextData(context, endIndex);

  return {
    type: NodeTypes.TEXT,
    content,
  };
}

function parseElement(context) { // <
  // Start tag.
  const element = parseTag(context); //返回的是 div的元素标签

  if (element.isSelfClosing || context.options.isVoidTag(element.tag)) { //如果是单闭合，或者判断 <hr> <input>
    return element;
  }

  // Children.
  element.children = parseChildren(context);

  // End tag.
  parseTag(context); //无意义，只是吃掉闭合标签

  return element;
}

function parseTag(context) {
  // Tag open.
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source); //标签名
  const tag = match[1]; //div

  advanceBy(context, match[0].length); //吃掉 <div
  advanceSpaces(context);

  // Attributes.
  const { props, directives } = parseAttributes(context);

  // Tag close.
  const isSelfClosing = context.source.startsWith('/>');

  advanceBy(context, isSelfClosing ? 2 : 1);

  const tagType = isComponent(tag, context) //以原生标签做判断
    ? ElementTypes.COMPONENT
    : ElementTypes.ELEMENT;

  return {
    type: NodeTypes.ELEMENT,
    tag, //标签名
    tagType, //是组件还是原生元素
    props, //属性节点数组
    directives, //指令数组
    isSelfClosing, //是否是自闭合标签
    children: [],
  };
}

function isComponent(tag, context) {
  const { options } = context;
  return !options.isNativeTag(tag);
}

function advanceSpaces(context) { //工具函数：吃掉所有的空格
  // （制表符、回车符、换行符、换页符和空格） +: 重复一次或更多次
  const match = /^[\t\r\n\f ]+/.exec(context.source); //match是匹配到的空格
  if (match) {
    advanceBy(context, match[0].length); //删除匹配到的空格
  }
}

function parseAttributes(context) {
  const props = []; //属性
  const directives = []; //指令
  while ( //一直处理 id='foo' v-if='ok
    context.source.length &&
    !context.source.startsWith('>') &&
    !context.source.startsWith('/>')
  ) {
    const attr = parseAttribute(context); //这里是已经去了空格的，并且这个函数处理完之后也是去了空格的，下一次处理时刚开头也是没有空格的
    if (attr.type === NodeTypes.ATTRIBUTE) {
      props.push(attr);
    } else {
      directives.push(attr);
    }
  }
  return { props, directives };
}

function parseAttribute(context) {
  // Name.
  // name判断很宽除了下述几个字符外都支持
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
  const name = match[0];

  advanceBy(context, name.length);
  advanceSpaces(context);

  // Value, 可能没有，比如组件的 isDark 属性
  let value;
  if (context.source[0] === '=') {
    advanceBy(context, 1);
    advanceSpaces(context);
    value = parseAttributeValue(context);
    advanceSpaces(context);
  }

  // Directive, 如果是指令就返回指令节点否则返回属性节点
  if (/^(v-|:|@)/.test(name)) { //根据拿到的name来判断是否是指令，如果是 :on @click v-on
    let dirName, argContent;
    if (name[0] === ':') {
      dirName = 'bind';
      argContent = name.slice(1);
    } else if (name[0] === '@') {
      dirName = 'on';
      argContent = name.slice(1);
    } else if (name.startsWith('v-')) {
      [dirName, argContent] = name.slice(2).split(':');
    }

    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      exp: value && { //参数，比如特指某个函数名称
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: value.content,
        isStatic: false,
      },
      arg: argContent && { //@click ，arg 就是 click
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: camelize(argContent), //驼峰
        isStatic: true,
      }
    };
  }

  // Attribute
  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    value: value && {
      type: NodeTypes.TEXT,
      content: value.content,
    },
  };
}

function parseAttributeValue(context) {
  // 不考虑没有引号的情况： id='foo'
  const quote = context.source[0]; //找引号
  advanceBy(context, 1);

  const endIndex = context.source.indexOf(quote);
  const content = parseTextData(context, endIndex);

  advanceBy(context, 1);

  return { content };
}
