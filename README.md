# mini-vue3  [![github](https://img.shields.io/badge/xiaoy-mini--vue3-blue)](https://github.com/mengqiuleo/mini-vue3)
To implement a mini vue3 for learn


## 📢 introduce

从 createApp 开始，模板编译、创建组件实例、运行渲染函数、挂载虚拟 dom、接合响应式系统、patch 更新渲染、scheduler 任务调度。

项目结构尽量还原 vue3 源码，只做主线任务。



## 💻 online website

[mini-vue3 预览地址](https://mengqiuleo.github.io/mini-vue3/)

测试案例均来自 [vuejs/core](https://github.com/vuejs/core/tree/main/packages/vue/examples)


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
通过 server 的方式打开 packages/vue/example/\* 下的 html 即可

> ❔ 推荐使用 [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)

### for [vue package](https://github.com/mengqiuleo/mini-vue3/tree/main/packages/vue)

```js
pnpm serve //开启本地服务，方便后续 cypress 测试

pnpm test
```

## 🎯 core function
### reactivity
- [x] reactive 的实现
- [x] ref 的实现
- [x] readonly 的实现
- [x] computed 的实现
- [x] track 依赖收集
- [x] trigger 触发依赖

### runtime
- [x] 支持组件类型
- [x] 支持 element 类型
- [x] patch
- [x] diff
- [x] h
- [x] scheduler调度器 
- [x] nextTick 的实现


### compiler
- [x] 解析插值
- [x] 解析 element
- [x] 解析 text

## ✅ todo
- [ ] 实现 slot
- [ ] 支持 getCurrentInstance
- [ ] 支持 provide/inject
- [ ] 支持 component emit
- [ ] 初始化 props
- [ ] setup 可获取 props 和 context

## 📑 Git 贡献提交规范
- feat 增加新功能
- fix 修复问题/BUG
- style 代码风格相关无影响运行结果的
- perf 优化/性能提升
- refactor 重构
- revert 撤销修改
- test 测试相关
- docs 文档/注释
- chore 依赖更新/脚手架配置修改等
- workflow 工作流改进
- ci 持续集成
- types 类型定义文件更改
- wip 开发中


## 💪🏻 参与贡献
1. Fork 本仓库
2. 新建 Feat_xxx 分支
3. 提交代码
4. 新建 Pull Request


## 👍🏻 thank
感谢 cuixiaorui 大佬的 [mini-vue](https://github.com/cuixiaorui/mini-vue)



## License
[MIT](https://opensource.org/licenses/MIT)

Copyright (c) 2023-present, mengqiuleo

<br/>


<h4>if you like this project, please star it😊</h4>