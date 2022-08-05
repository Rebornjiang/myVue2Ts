import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
export function optimize(
  root: ASTElement | null | undefined,
  options: CompilerOptions
) {
  if (!root) return
  // isTaticKey 是一个函数,用于从缓存的 map 对象取值,map 对象的 key 为 存在staticKey,类似 { staticKey: true }
  // 存在的 staticKey 由 baseOptions中定义 + 默认的 staticKey
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  markStatic(root)
  // second pass: mark static roots.
  markStaticRoots(root, false)
}

function genStaticKeys(keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
      (keys ? ',' + keys : '')
  )
}

function markStatic(node: ASTNode) {
  node.static = isStatic(node)
  if (node.type === 1) {
    // 不能够将组件插槽标记为静态的
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      // 如果子内容不是静态节点,父节点不管原来是什么节点,也会将静态标记设置为false
      if (!child.static) {
        node.static = false
      }
    }

    //
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}

function markStaticRoots(node: ASTNode, isInFor: boolean) {
  // 仅对 标签AST进行标记
  if (node.type === 1) {
    if (node.static || node.once) {
      // 记录当前静态节点是否在 for 循环节点里面
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    /**
     * 静态根节点需要同时满足下面三个条件:
     * 属于静态节点
     * 元素节点
     * 拥有 >1个的子节点 || 子节点不能够是纯文本节点 type != 3 （type 只可能 = 1）
     *
     * 以下不会被标记文 statickRoot:
     * <span>我是一个纯文本节点</span>
     * */
    if (
      node.static &&
      node.children.length &&
      !(node.children.length === 1 && node.children[0].type === 3)
    ) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }

    // 如果有 children 进行递归处理
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }

    // 当前节点如果是 v-if 节点,需要处理其 v-esle,v-else-if 节点
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}

function isStatic(node: ASTNode): boolean {
  if (node.type === 2) {
    // expression
    return false
  }
  if (node.type === 3) {
    // text
    return true
  }

  //<span :dynamic="prop" @click="handleClick" v-pre>{{msg}} </span>
  // 对于上面这样的节点, 如果 带有 v-pre, parse 解析时, AST Node 将会有 pre 标记为 true
  /***
   * AST Node 对象
   *attrsList: [{…}]
    attrsMap: {v-pre: '', :remaindynamicprop: 'nnnnn'}
    children: []
    end: 226
    parent: {type: 1, tag: 'div', attrsList: Array(1), attrsMap: {…}, rawAttrsMap: {…}, …}
    pre: true
    rawAttrsMap: {v-pre: {…}, :remaindynamicprop: {…}}
    start: 184
    tag: "span"
    type: 1 
  * 
   **/

  // v-pre 节点一定是静态节点
  return !!(
    (
      node.pre ||
      (!node.hasBindings && // no dynamic bindings
        !node.if &&
        !node.for && // not v-if or v-for or v-else
        !isBuiltInTag(node.tag) && // not a built-in ,非 slot 和 component
        isPlatformReservedTag(node.tag) && // not a component ,是平台保留标签
        !isDirectChildOfTemplateFor(node) && // 不能够是 v-for 节点的子节点
        Object.keys(node).every(isStaticKey))
    ) // 当前 AST 节点的所有 属性必须满足 staticKey,这里的 staticKey 可以理解成: 非vue语法的标签AST所拥有的最基本的属性
  )
}

function isDirectChildOfTemplateFor(node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
