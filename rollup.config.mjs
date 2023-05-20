import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default {
  input: './packages/vue/index.js',
  output: [
    // 打包出两个模块规范：cjs, esm
    {
      format: 'cjs',
      file: './packages/vue/dist/mini-vue.cjs.js'
    },
    {
      format: 'es',
      file: './packages/vue/dist/mini-vue.esm.js'
    },
    {
      format: 'iife',
      file: './packages/vue/dist/mini-vue.bundle.js'
    }
  ],
  plugins: [
    resolve(),
    commonjs()
  ]
}