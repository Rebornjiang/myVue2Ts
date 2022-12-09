/* not type checking this file because flow doesn't play well with Proxy */

import config from 'core/config'
import { warn, makeMap, isNative } from '../util/index'

let initProxy

if (__DEV__) {
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
      'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
      'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,' +
      'require' // for Webpack/Browserify
  )

  const warnNonPresent = (target, key) => {
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
        'referenced during render. Make sure that this property is reactive, ' +
        'either in the data option, or for class-based components, by ' +
        'initializing the property. ' +
        'See: https://vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
      target
    )
  }

  const warnReservedPrefix = (target, key) => {
    warn(
      `Property "${key}" must be accessed with "$data.${key}" because ` +
        'properties starting with "$" or "_" are not proxied in the Vue instance to ' +
        'prevent conflicts with Vue internals. ' +
        'See: https://vuejs.org/v2/api/#data',
      target
    )
  }

  const hasProxy = typeof Proxy !== 'undefined' && isNative(Proxy)

  if (hasProxy) {
    const isBuiltInModifier = makeMap(
      'stop,prevent,self,ctrl,shift,alt,meta,exact'
    )
    config.keyCodes = new Proxy(config.keyCodes, {
      set(target, key: string, value) {
        if (isBuiltInModifier(key)) {
          warn(
            `Avoid overwriting built-in modifier in config.keyCodes: .${key}`
          )
          return false
        } else {
          target[key] = value
          return true
        }
      }
    })
  }

  const hasHandler = {
    has(target, key) {
      const has = key in target

      // 允许访问全局成员 || vue实例的私有的 render-helpers 方法 例如：_c , _s, _v
      const isAllowed =
        allowedGlobals(key) ||
        (typeof key === 'string' &&
          key.charAt(0) === '_' &&
          !(key in target.$data))

      console.log(key in target.$data, '是否存在')
      if (!has && !isAllowed) {
        if (key in target.$data) warnReservedPrefix(target, key)
        else warnNonPresent(target, key)
      }

      // !isAllowed 之所以要取反是为了全局成员的，例如 String Infinity 等，若是不进行取反，has 方法返回true，接下来直接会从 vm 上找这些成员，没有就抛出 referenceError
      return has || !isAllowed
    }
  }

  const getHandler = {
    get(target, key) {
      if (typeof key === 'string' && !(key in target)) {
        if (key in target.$data) warnReservedPrefix(target, key)
        else warnNonPresent(target, key)
      }
      return target[key]
    }
  }

  initProxy = function initProxy(vm) {
    if (hasProxy) {
      // determine which proxy handler to use
      /**
       * Q:为什么在开发环境需要给 render 函数 内部的 this 作一层代理
       * - 对于定义 options data 中的以 _ || $ 开始的属性,其实并没有被代理到 vm上，在 initData 中也没有给出警告提示，因为不确定你会用，当你使用这个属性那就要给出警告信息
       * */

      const options = vm.$options
      const handlers =
        options.render && options.render._withStripped ? getHandler : hasHandler
      vm._renderProxy = new Proxy(vm, handlers)
    } else {
      vm._renderProxy = vm
    }
  }
}

export { initProxy }
