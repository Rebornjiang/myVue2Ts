import { warn, invokeWithErrorHandling } from 'core/util/index'
import { cached, isUndef, isTrue, isArray } from 'shared/util'
import type { Component } from 'typescript/component'

const normalizeEvent = cached(
  (
    name: string
  ): {
    name: string
    once: boolean
    capture: boolean
    passive: boolean
    handler?: Function
    params?: Array<any>
  } => {
    const passive = name.charAt(0) === '&'
    name = passive ? name.slice(1) : name
    const once = name.charAt(0) === '~' // Prefixed last, checked first
    name = once ? name.slice(1) : name
    const capture = name.charAt(0) === '!'
    name = capture ? name.slice(1) : name
    return {
      name,
      once,
      capture,
      passive
    }
  }
)

export function createFnInvoker(
  fns: Function | Array<Function>,
  vm?: Component
): Function {
  function invoker() {
    const fns = invoker.fns
    if (isArray(fns)) {
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        invokeWithErrorHandling(
          cloned[i],
          null,
          arguments as any,
          vm,
          `v-on handler`
        )
      }
    } else {
      // return handler return value for single handlers
      return invokeWithErrorHandling(
        fns,
        null,
        arguments as any,
        vm,
        `v-on handler`
      )
    }
  }
  invoker.fns = fns
  return invoker
}

// updateListeners 这个方法会用在 创建或是更新（组件自定义事件 和 原生dom 事件）这两个方法内，因此被抽象到 core 模块下的 helpers 这个目录下
export function updateListeners(
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  createOnceHandler: Function,
  vm: Component
) {
  let name, cur, old, event
  for (name in on) {
    cur = on[name]
    old = oldOn[name]
    // normalizeEvent 是对 事件名作解析，在 parse 阶段时，
    // 对于一些特定 modifier 会给 事件名进行添加额外的标记，如 click.passive => &click
    event = normalizeEvent(name)
    // isUndef 更多是在手写 render 的情况
    if (isUndef(cur)) {
      __DEV__ &&
        warn(
          `Invalid handler for event "${event.name}": got ` + String(cur),
          vm
        )
    } else if (isUndef(old)) {
      if (isUndef(cur.fns)) {
        // 重写 事件处理函数的目的主要时为着更新事件考虑的，避免每次更新都需要重复的调用 DOM.addEventListeners
        cur = on[name] = createFnInvoker(cur, vm)
      }

      if (isTrue(event.once)) {
        cur = on[name] = createOnceHandler(event.name, cur, event.capture)
      }

      add(event.name, cur, event.capture, event.passive, event.params)
    } else if (cur !== old) {
      // update 钩子走这里，并且新旧 vnode handler 不一样
      old.fns = cur
      on[name] = old
    }
  }
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
