import { compile } from '@mini-vue3/compiler';
import {
  createApp,
  render,
  h,
  Text,
  Fragment,
  renderList,
  resolveComponent,
  registerRuntimeCompiler,
  withModel,
  nextTick,
  reactive,
  ref,
  computed,
  effect
} from '@mini-vue3/runtime';

function compileToFunction() {
  return compile
}

registerRuntimeCompiler(compileToFunction());

export const MiniVue = (window.MiniVue = {
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
  compile
});
