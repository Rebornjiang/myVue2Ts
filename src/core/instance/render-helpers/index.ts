import { toNumber, toString, looseEqual, looseIndexOf } from 'shared/util'
import { createTextVNode, createEmptyVNode } from 'core/vdom/vnode'
import { renderList } from './render-list'
import { renderSlot } from './render-slot'
import { resolveFilter } from './resolve-filter'
import { checkKeyCodes } from './check-keycodes'
import { bindObjectProps } from './bind-object-props'
import { renderStatic, markOnce } from './render-static'
import { bindObjectListeners } from './bind-object-listeners'
import { resolveScopedSlots } from './resolve-scoped-slots'
import { bindDynamicKeys, prependModifier } from './bind-dynamic-keys'
import { createElement } from 'core/vdom/create-element'

export function installRenderHelpers(target: any) {
  target._o = markOnce
  target._n = toNumber // 转 Number
  target._s = toString // 将值转为字符串，obj | arr | other 其他类型的值
  target._l = renderList // 处理 v-for
  target._t = renderSlot
  target._q = looseEqual
  target._i = looseIndexOf
  target._m = renderStatic
  target._f = resolveFilter
  target._k = checkKeyCodes
  target._b = bindObjectProps
  target._v = createTextVNode // 创建 textVNode
  target._e = createEmptyVNode // 生成 注释节点
  target._u = resolveScopedSlots
  target._g = bindObjectListeners
  target._d = bindDynamicKeys
  target._p = prependModifier
  //
  target._c = function (a, b, c, d) {
    const vm = this
    return createElement(vm, a, b, c, d, false)
  }
}
