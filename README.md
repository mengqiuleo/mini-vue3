# mini-vue  [![github](https://img.shields.io/badge/xiaoy-mini--vue-blue)](https://github.com/mengqiuleo/mini-vue3)
To implement a mini vue3 for learn


## 📢 introduce

从 createApp 开始，模板编译、创建组件实例、运行渲染函数、挂载虚拟 dom、接合响应式系统、patch 更新渲染、scheduler 任务调度。

项目结构尽量还原 vue3 源码，只做主线任务。



## 💻 online website

[mini-vue3 预览地址](https://mengqiuleo.github.io/mini-vue3/)


## ✨ feature
- 使用 monorepo 架构
- 实现 vue3 的三大核心模块：reactivity、runtime 以及 compiler 模块
- jest: unit test
- cypress: E2E test

## 🤟 how to use

### project init

```js
git clone git@github.com:mengqiuleo/mini-vue3.git

cd mini-vue3

pnpm i
```

### test
```js
pnpm test
```

### build

```js
pnpm build
```

### example
通过 server 的方式打开 packages/vue/example/\* 下的 index.html 即可

> ❔ 推荐使用 [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)

### for [vue package](https://github.com/mengqiuleo/mini-vue3/tree/main/packages/vue)

```js
pnpm serve //开启本地服务，方便后续 cypress 测试

pnpm test
```

## ✅ TODO
- 实现 slot
- 支持 getCurrentInstance
- 支持 provide/inject
- 支持 component emit
- 初始化 props
- setup 可获取 props 和 context




## 👍🏻 thank
感谢 cuixiaorui 大佬的 [mini-vue](https://github.com/cuixiaorui/mini-vue)

<br/>

<h4>if you like this project, please star it😊</h4>