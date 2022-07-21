import { _Set as Set, isObject, isArray } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
export function traverse(val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

function _traverse(val: any, seen: SimpleSet) {
  let i, keys
  const isA = isArray(val)
  // Object.isFrozen 判断一个对象是否被冻结，如果是一个 primitive 类型的数据也是冻结的
  if (
    (!isA && !isObject(val)) ||
    Object.isFrozen(val) ||
    val instanceof VNode
  ) {
    return
  }

  // 判断一个对象是否是响应式数据
  if (val.__ob__) {
    const depId = val.__ob__.dep.id

    // 涉及循环引用
    if (seen.has(depId)) {
      return
    }

    seen.add(depId)
  }

  // 如果是数组就遍历每一个，调用
  if (isA) {
    i = val.length
    // 为 每一个 Item 来收集依赖
    while (i--) _traverse(val[i], seen)
  }
  // 对象就取key
  else {
    keys = Object.keys(val)
    i = keys.length
    // 这里会触发该响应式数据的getter方法，为每一个对象的属性收集依赖，就与 侦听器 wathcer建立关系，当响应式数据触发 setter 方时，callback 会调用
    while (i--) _traverse(val[keys[i]], seen)
  }
}
