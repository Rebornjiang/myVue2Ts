import { isDef, isUndef } from 'shared/util'
import { updateListeners } from 'core/vdom/helpers/index'
import { isIE, isFF, supportsPassive, isUsingMicroTask } from 'core/util/index'
import {
  RANGE_TOKEN,
  CHECKBOX_RADIO_TOKEN
} from 'web/compiler/directives/model'
import { currentFlushTimestamp } from 'core/observer/scheduler'
import { emptyNode } from 'core/vdom/patch'
import type { VNodeWithData } from 'typescript/vnode'

// normalize v-model event tokens that can only be determined at runtime.
// it's important to place the event as the first in the array because
// the whole point is ensuring the v-model callback gets called before
// user-attached handlers.
function normalizeEvents(on) {
  /* istanbul ignore if */
  if (isDef(on[RANGE_TOKEN])) {
    // IE input[type=range] only supports `change` event
    const event = isIE ? 'change' : 'input'
    on[event] = [].concat(on[RANGE_TOKEN], on[event] || [])
    delete on[RANGE_TOKEN]
  }
  // This was originally intended to fix #4521 but no longer necessary
  // after 2.5. Keeping it for backwards compat with generated code from < 2.4
  /* istanbul ignore if */
  if (isDef(on[CHECKBOX_RADIO_TOKEN])) {
    on.change = [].concat(on[CHECKBOX_RADIO_TOKEN], on.change || [])
    delete on[CHECKBOX_RADIO_TOKEN]
  }
}

let target: any

function createOnceHandler(event, handler, capture) {
  const _target = target // save current target element in closure
  return function onceHandler() {
    const res = handler.apply(null, arguments)
    if (res !== null) {
      remove(event, onceHandler, capture, _target)
    }
  }
}

// #9446: Firefox <= 53 (in particular, ESR 52) has incorrect Event.timeStamp
// implementation and does not fire microtasks in between event propagation, so
// safe to exclude.
const useMicrotaskFix = isUsingMicroTask && !(isFF && Number(isFF[1]) <= 53)

function add(
  name: string,
  handler: Function,
  capture: boolean,
  passive: boolean
) {
  // async edge case #6566: inner click event triggers patch, event handler
  // attached to outer element during patch, and triggered again. This
  // happens because browsers fire microtask ticks between event propagation.
  // the solution is simple: we save the timestamp when a handler is attached,
  // and the handler would only fire if the event passed to it was fired
  // AFTER it was attached.
  if (useMicrotaskFix) {
    const attachedTimestamp = currentFlushTimestamp
    const original = handler
    //@ts-expect-error
    handler = original._wrapper = function (e) {
      if (
        // no bubbling, should always fire.
        // this is just a safety net in case event.timeStamp is unreliable in
        // certain weird environments...
        e.target === e.currentTarget ||
        // event is fired after handler attachment
        e.timeStamp >= attachedTimestamp ||
        // bail for environments that have buggy event.timeStamp implementations
        // #9462 iOS 9 bug: event.timeStamp is 0 after history.pushState
        // #9681 QtWebEngine event.timeStamp is negative value
        e.timeStamp <= 0 ||
        // #9448 bail if event is fired in another document in a multi-page
        // electron/nw.js app, since event.timeStamp will be using a different
        // starting reference
        e.target.ownerDocument !== document
      ) {
        return original.apply(this, arguments)
      }
    }
  }
  target.addEventListener(
    name,
    handler,
    supportsPassive ? { capture, passive } : capture
  )
}

function remove(
  name: string,
  handler: Function,
  capture: boolean,
  _target?: HTMLElement
) {
  ;(_target || target).removeEventListener(
    name,
    //@ts-expect-error
    handler._wrapper || handler,
    capture
  )
}

function updateDOMListeners(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  // create触发时： oldVnode 为 empltyNode
  if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
    return
  }
  // 无论是 组件还是 html 元素都取 vnodeData.on, 按理说组件的原生事件被存在了 vnodeData.nativeOn 中，
  // 这是因为在创建组件 vnode 的时候，对vnodeData 做了一层处理
  const on = vnode.data.on || {}
  const oldOn = oldVnode.data.on || {}
  // vnode is empty when removing all listeners,
  // and use old vnode dom element
  target = vnode.elm || oldVnode.elm
  // 处理 v-model
  normalizeEvents(on)

  updateListeners(on, oldOn, add, remove, createOnceHandler, vnode.context)
  target = undefined
}
/**
 * 事件相关的钩子 有 3个，分别在 patch 时，create，update，destory 阶段会被调用
 * create：对于 当前 HTML 元素来说，在其子节点都被递归创建完成之后，并挂载到 当前 HTML DOM 上之后，调用 create 钩子
 * */
export default {
  create: updateDOMListeners,
  update: updateDOMListeners,
  // @ts-expect-error emptyNode has actually data
  destroy: (vnode: VNodeWithData) => updateDOMListeners(vnode, emptyNode)
}
