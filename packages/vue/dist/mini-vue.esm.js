function isObject(value) {
  return typeof value === 'object' && value !== null;
}

function isFunction(value) {
  return typeof value === 'function';
}

function isArray(value) {
  return Array.isArray(value);
}

function isString(value) {
  return typeof value === 'string';
}

function isNumber(value) {
  return typeof value === 'number';
}

function hasChanged(value, oldValue) {
  return value !== oldValue && (value === value || oldValue === oldValue);
}

const camelizeRE = /-(\w)/g;
function camelize(str) {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''));
}

function capitalize(str) {
  return str[0].toUpperCase() + str.slice(1);
}

const NodeTypes = {
  ROOT: 'ROOT',
  ELEMENT: 'ELEMENT',
  TEXT: 'TEXT',
  SIMPLE_EXPRESSION: 'SIMPLE_EXPRESSION',
  INTERPOLATION: 'INTERPOLATION',
  ATTRIBUTE: 'ATTRIBUTE',
  DIRECTIVE: 'DIRECTIVE',
};

const ElementTypes = {
  ELEMENT: 'ELEMENT',
  COMPONENT: 'COMPONENT',
};

function createRoot(children) {
  return {
    type: NodeTypes.ROOT,
    children,
  };
}

function parse(content) {
  const context = createParserContext(content);
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
      node = parseInterpolation(context);
    } else if (s[0] === '<') {
      node = parseElement(context);
    } else {
      node = parseText(context);
    }
    nodes.push(node);
  }

  let removedWhitespace = false;
  for (let i = 0; i < nodes.length; i++) {
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
  const endTokens = ['<', context.options.delimiters[0]];//右边结束位置，</ {{ 或者文本最末尾，谁下标最小取谁

  // 寻找text最近的endIndex。因为遇到'<'或'{{'都可能结束
  let endIndex = context.source.length;
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1);
    if (index !== -1 && endIndex > index) {
      endIndex = index;
    }
  }

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

function advanceSpaces(context) { //吃掉所有的空格
  const match = /^[\t\r\n\f ]+/.exec(context.source);
  if (match) {
    advanceBy(context, match[0].length);
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

function generate(ast) {
  const returns = traverseNode(ast);
  const code = `
with (ctx) {
    const { h, Text, Fragment, renderList, resolveComponent, withModel } = MiniVue
    return ${returns}
}`;
  return code;
}

function traverseNode(node, parent) {
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
          if (/\([^)]*?\)$/.test(exp) && !exp.includes('=>')) {
            exp = `$event => (${exp})`;
          }
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
function pluck(directives, name, remove = true) {
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

function compile$1(template) {
  const ast = parse(template);
  return generate(ast);
}

const HTML_TAGS =
  'html,body,base,head,link,meta,style,title,address,article,aside,footer,' +
  'header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,div,dd,dl,dt,figcaption,' +
  'figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,' +
  'data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,s,samp,small,span,strong,sub,sup,' +
  'time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,' +
  'canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,' +
  'th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,' +
  'option,output,progress,select,textarea,details,dialog,menu,' +
  'summary,template,blockquote,iframe,tfoot';

const VOID_TAGS =
  'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr';

function makeMap(str) {
  const map = str
    .split(',')
    .reduce((map, item) => ((map[item] = true), map), Object.create(null));
  return (val) => !!map[val];
}

const isVoidTag = makeMap(VOID_TAGS);
const isNativeTag = makeMap(HTML_TAGS);

let activeEffect;
const effectStack = [];

class ReactiveEffect{ //* 一种封装的思想
  // private _fn: any
  // deps = []
  // active = true //控制stop是否已经清理过, true表示还没clean
  // onStop?: () => void
  constructor(fn, scheduler = null){
    this._fn = fn;
    this.scheduler = scheduler;
    this.deps = [];
    this.active = true; //控制stop是否已经清理过, true表示还没clean
    this.opStop = () => {};
  }

  run(){
    effectStack.push(this);
    activeEffect = this;
    if(!this.active){ //false:已经clean过了，以后不用追踪
      return this._fn()
    }

    const result = this._fn();

    effectStack.pop();
    activeEffect = effectStack[effectStack.length-1];
    return result
  }

  stop(){
    //m频繁调用 stop 时，如果清空过了，就不用再清空了
    if(this.active){
      cleanupEffect(this);
      if(this.onStop){
        this.onStop();
      }
      this.active = false;
    }
  }
}

function cleanupEffect(effect){
  effect.deps.forEach((dep) => { //dep代表某个key的所有effect，是一个set
    dep.delete(effect); //让每一个set删除当前effect
  });
  effect.deps.length = 0;
}

const targetMap = new Map(); //所有对象，映射
function track(target, key){
  // if(!activeEffect) return
  // if(!shouldTrack) return
  //对上面代码优化
  if(!activeEffect) return

  // 每一个 target 的每一个属性都要存，容器 Set
  // target -> key -> dep
  let depsMap = targetMap.get(target);
  if(!depsMap){
    depsMap = new Map();
    targetMap.set(target, depsMap);
  }
  let dep = depsMap.get(key); //dep: 对应的多个更新函数， 一个属性牵连着多个更新函数
  if(!dep){
    dep = new Set();
    depsMap.set(key, dep);
  }

  // trackEffects(dep)
  dep.add(activeEffect);
}

function trigger(target, key){
  let depsMap = targetMap.get(target);
  if(!depsMap) return
  let dep = depsMap.get(key);

  if(!dep) return
  // triggerEffects(dep)
  dep.forEach((effect) => {
    if (effect.scheduler) {
      effect.scheduler();
    } else {
      effect.run();
    }
  });
}

function effect(fn, options = {}){
  const _effect = new ReactiveEffect(fn);
  // _effect.onStop = options.onStop
  // 将上面这行代码进行优化
  // Object.assign(_effect, options)
  //再次进行优化，抽离一个公共函数
  if(!options.lazy){
    _effect.run();
  }
  // extend(_effect, options)
  _effect.scheduler = options.scheduler;

  const runner =  _effect.run.bind(_effect); // 返回的那个runner函数
  runner.effect = _effect;
  return runner
  // return _effect.run
}

const reactiveMap = new WeakMap();

function reactive(target) {
  if (!isObject(target)) {
    return target;
  }
  if (isReactive(target)) {
    return target;
  }
  if (reactiveMap.has(target)) {
    return reactiveMap.get(target);
  }
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      if (key === '__isReactive') {
        return true;
      }
      track(target, key);
      const res = Reflect.get(target, key, receiver);
      return isObject(res) ? reactive(res) : res;
    },
    set(target, key, value, receiver) {
      const oldValue = target[key];
      const oldLength = target.length;
      const res = Reflect.set(target, key, value, receiver);
      if (hasChanged(value, oldValue)) {
        trigger(target, key);
        if (isArray(target) && target.length !== oldLength) {
          trigger(target, 'length');
        }
      }
      return res;
    },
  });
  reactiveMap.set(target, proxy);
  return proxy;
}

function isReactive(target) {
  return !!(target && target.__isReactive);
}

function ref(value) {
  if (isRef(value)) {
    return value;
  }
  return new RefImpl(value);
}

function isRef(value) {
  return !!(value && value.__isRef);
}

class RefImpl {
  constructor(value) {
    this.__isRef = true;
    this._value = convert(value);
  }

  get value() {
    track(this, 'value');
    return this._value;
  }

  set value(val) {
    if (hasChanged(val, this._value)) {
      this._value = convert(val);
      trigger(this, 'value');
    }
  }
}

function convert(value) {
  return isObject(value) ? reactive(value) : value;
}

function computed(getterOrOptions) {
  let getter, setter;
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions;
    setter = () => {
      console.warn('Write operation failed: computed value is readonly');
    };
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }

  return new ComputedRefImpl(getter, setter);
}

class ComputedRefImpl {
  constructor(getter, setter) {
    this._setter = setter;
    this._value = undefined;
    this._dirty = true;
    this.effect = effect(getter, {
      lazy: true,
      scheduler: () => {
        if (!this._dirty) {
          this._dirty = true;
          trigger(this, 'value');
        }
      },
    });
  }

  get value() {
    if (this._dirty) {
      this._value = this.effect();
      this._dirty = false;
      track(this, 'value');
    }
    return this._value;
  }

  set value(val) {
    this._setter(val);
  }
}

const Text = Symbol('Text');
const Fragment = Symbol('Fragment');

const ShapeFlags = {
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
function h(type, props = null, children = null) {
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
    el: null,//当前虚拟节点对应的真实节点
    anchor: null, // fragment专有
    key: props && (props.key != null ? props.key : null),
    component: null, // 组件的instance
  };
}

function normalizeVNode(result) {
  if (Array.isArray(result)) {
    return h(Fragment, null, result);
  }
  if (isObject(result)) {
    return result;
  }
  return h(Text, null, result.toString());
}

function patchProps(el, oldProps, newProps) {
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

const domPropsRE = /[A-Z]|^(value|checked|selected|muted|disabled)$/;
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
      if (/^on[^a-z]/.test(key)) {
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
      } else if (domPropsRE.test(key)) {
        if (next === '' && typeof el[key] === 'boolean') {
          next = true;
        }
        el[key] = next;
      } else {
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

const queue = [];
let isFlushing = false;
const resolvedPromise = Promise.resolve();
let currentFlushPromise = null;

function nextTick(fn) {
  const p = currentFlushPromise || resolvedPromise;
  return fn ? p.then(fn) : p;
}

function queueJob(job) {
  if (!queue.length || !queue.includes(job)) {
    queue.push(job);
    queueFlush();
  }
}

function queueFlush() {
  if (!isFlushing) {
    isFlushing = true;
    currentFlushPromise = resolvedPromise.then(flushJobs);
  }
}

function flushJobs() {
  try {
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i];
      job();
    }
  } finally {
    isFlushing = false;
    queue.length = 0;
    currentFlushPromise = null;
  }
}

// import { compile } from '../compiler/index';
let compile;
function updateProps(instance, vnode) {
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
  instance.props = reactive(instance.props);
}

function fallThrough(instance, subTree) {
  if (Object.keys(instance.attrs).length) {
    subTree.props = {
      ...subTree.props,
      ...instance.attrs,
    };
  }
}

function mountComponent(vnode, container, anchor, patch) {
  const { type: Component } = vnode;

  // createComponentInstance
  const instance = (vnode.component = {
    props: {},
    attrs: {},
    setupState: null,
    ctx: null,
    update: null,
    isMounted: false,
    subTree: null,
    next: null, // 组件更新时，把新vnode暂放在这里
  });

  // setupComponent
  updateProps(instance, vnode);

  // 源码：instance.setupState = proxyRefs(setupResult)
  instance.setupState = Component.setup?.(instance.props, {
    attrs: instance.attrs,
  });

  instance.ctx = {
    ...instance.props,
    ...instance.setupState,
  };

  if (!Component.render && Component.template) {
    let { template } = Component;
    if (template[0] === '#') {
      const el = document.querySelector(template);
      template = el ? el.innerHTML : '';
    }
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
        queueJob(instance.update);
      }
    }
  );
}

function registerRuntimeCompiler(_compile) {
  compile = _compile;
}

function render(vnode, container) {
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

// n1可能为null，n2不可能为null
function patch(n1, n2, container, anchor) {
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
    patchProps(el, null, props);
  }

  vnode.el = el;
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
  n2.component.next = n2;
  n2.component.update();
}

function unmount(vnode) {
  const { shapeFlag, el } = vnode;
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
  // eslint-disable-next-line prefer-const
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
    if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
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
        if (c1[0] && c1[0].key != null && c2[0] && c2[0].key != null) {
          patchKeyedChildren(c1, c2, container, anchor);
        } else {
          patchUnkeyedChildren(c1, c2, container, anchor);
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

  if (i > e1) {
    // 3.经过1、2直接将旧结点比对完，则剩下的新结点直接mount
    const nextPos = e2 + 1;
    const curAnchor = (c2[nextPos] && c2[nextPos].el) || anchor;
    for (let j = i; j <= e2; j++) {
      patch(null, c2[j], container, curAnchor);
    }
  } else if (i > e2) {
    // 3.经过1、2直接将新结点比对完，则剩下的旧结点直接unmount
    for (let j = i; j <= e1; j++) {
      unmount(c1[j]);
    }
  } else {
    // 4.采用传统diff算法，但不真的添加和移动，只做标记和删除
    const map = new Map();
    for (let j = i; j <= e1; j++) {
      const prev = c1[j];
      map.set(prev.key, { prev, j });
    }
    // used to track whether any node has moved
    let maxNewIndexSoFar = 0;
    let move = false;
    const toMounted = [];
    const source = new Array(e2 - i + 1).fill(-1);
    for (let k = 0; k < e2 - i + 1; k++) {
      const next = c2[k + i];
      if (map.has(next.key)) {
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
      for (let k = source.length - 1; k >= 0; k--) {
        if (k === seq[j]) {
          // 不用移动
          j--;
        } else {
          const pos = k + i;
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

let components;
function createApp(rootComponent) {
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

      render(h(rootComponent), rootContainer);
    },
  };
  return app;
}

function resolveComponent(name) {
  return (
    components &&
    (components[name] ||
      components[camelize(name)] ||
      components[capitalize(camelize(name))])
  );
}

//renderList(items, (item, index) => h('div', null, item + index))
function renderList(source, renderItem) {
  const vnodes = [];
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

function withModel(tag, props, getter, setter) {
  props = props || {};
  if (tag === 'input') {
    switch (props.type) {
      case 'radio':
        props.checked = getter() === props.value;
        props.onChange = (e) => setter(e.target.value);
        break;
      case 'checkbox':
        const modelValue = getter();
        if (isArray(modelValue)) {
          props.checked = modelValue.includes(props.value);
          props.onChange = (e) => {
            const { value } = e.target;
            const values = new Set(getter());
            if (values.has(value)) {
              values.delete(value);
            } else {
              values.add(value);
            }
            props.checked = values.has(props.value);
            setter([...values]);
          };
        } else {
          props.checked = modelValue;
          props.onChange = (e) => {
            props.checked = e.target.checked;
            setter(e.target.checked);
          };
        }
        break;
      default:
        // 'input'
        props.value = getter();
        props.onInput = (e) => setter(e.target.value);
        break;
    }
  }
  return props;
}

function compileToFunction() {
  return compile$1
}

registerRuntimeCompiler(compileToFunction());

const MiniVue = (window.MiniVue = {
  createApp,
  render,
  h,
  Text,
  Fragment,
  renderList,
  resolveComponent,
  withModel,
  nextTick,
  reactive,
  ref,
  computed,
  effect,
  compile: compile$1
});

export { MiniVue };
