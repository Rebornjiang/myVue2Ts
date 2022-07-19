/**
 * unicode letters used for parsing html tags, component names and property paths.
 * using https://www.w3.org/TR/html53/semantics-scripting.html#potentialcustomelementname
 * skipping \u10000-\uEFFFF due to it freezing up PhantomJS
 */
export const unicodeRegExp =
  /a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/

/**
 * Check if a string starts with $ or _
 */
export function isReserved(str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5f
}

/**
 * Define a property.
 */
export function def(obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * Parse simple path.
 */
const bailRE = new RegExp(`[^${unicodeRegExp.source}.$_\\d]`)
export function parsePath(path: string): any {
  if (bailRE.test(path)) {
    return
  }
  // 将路径通过 . 分隔符进行分段
  const segments = path.split('.')
  // obj 为 vm
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      /*
      一、对于普通响应式数据（watch options 中的key 为data中定义的 属性）：
      1.此处触发响应式数据的 getter，进行依赖手机，将响应式数据与 当前侦听器 watcher 进行互相关联

      二、对于 computed（watchOptions 中的 key 为 computed 中的属性） ：
      1. 触发了 computed 的 getter 方法
      2. 在computed getter 中会判断 computedWatcher 此前是否已经计算过，没有计算过 调用 watcher.evaluate 会进行计算，
      3. 在计算过程中会为 computedWatcher 进行依赖收集
      4. 计算完成之后会为 watchWatcher 进行依赖收集，computedWatcher 所收集的 deps 也添加到 watchWatcher 里面，同时 depItem 也将watchWatcher 存在自己的 subs 里面
      5. 对于监听 computed 来说，computed所依赖的响应式数据对应的dep 的 subs 同时会存在与 computedWatcher、watchWatcher、
      */
      obj = obj[segments[i]]
    }
    // obj = value
    return obj
  }
}
