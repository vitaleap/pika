import { cloneDeep } from 'es-toolkit'

/**
 * 从树结构中查找节点数据
 * @param tree 树结构数据
 * @param find 查找表达式
 * @returns 节点数据或undefined
 */
export const treeFind = <T extends { children?: T[]; [x: string]: unknown }>(
  tree: T[],
  find: (data: T) => boolean,
): T | undefined => {
  for (const item of tree) {
    if (find(item)) {
      return item
    }
    if (!item.children?.length) {
      continue
    }
    const found = treeFind(item.children, find)
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}

/**
 * 树结构数据转换
 * @param tree 树结构数据
 * @param map 转换表达式
 * @returns 新的树结构数据
 */
export const treeMap = <
  T extends { children?: T[]; [x: string]: unknown },
  R extends { [x: string]: unknown },
>(
  tree: readonly T[],
  map: (data: T) => R,
) => {
  return tree.map((item: T): R => ({
    ...map(cloneDeep(item)),
    children: item.children ? treeMap(item.children, map) : undefined,
  }))
}

/**
 * 树结构数据过滤
 * @param tree 树结构数据
 * @param filter 过滤方法，返回true则保留
 * @returns 过滤后的树结构数据
 */
export const treeFilter = <T extends { children?: T[]; [x: string]: unknown }>(
  tree: T[],
  filter: (data: T) => boolean,
) => {
  const result: T[] = []
  for (const item of tree) {
    const valid = filter(item)
    if (!valid) {
      continue
    }
    const node = cloneDeep(item)
    if (node.children !== undefined) {
      node.children = treeFilter(node.children, filter)
    }
    result.push(node)
  }
  return result
}
