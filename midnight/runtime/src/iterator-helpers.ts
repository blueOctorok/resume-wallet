/**
 * Iterator Helpers polyfill for Node 20.
 *
 * The Midnight wallet SDK is written for Node 22+, where TC39 Iterator Helpers
 * (`.map`, `.filter`, `.find`, `.toArray`, `.every`, ...) are native methods on
 * every iterator. It calls them directly on the iterators returned by real
 * `Map`/`Set` objects, e.g.:
 *
 *   tx.imbalances(0).entries().filter(...).map(...)          // wallet-sdk-shielded
 *   transaction.imbalances(0, fee).entries().find(...)       // wallet-sdk-dust-wallet
 *   allTokenTypes.values().map(...).filter(...).toArray()    // wallet-sdk-capabilities
 *
 * On Node 20 those helpers don't exist, so the calls throw
 * "X.entries(...).filter is not a function" during transaction balancing.
 *
 * Because all of these iterators come from standard `Map`/`Set` instances (see the
 * SDK's own `ledger-v8.d.ts` — `imbalances()` returns `Map<TokenType, bigint>`),
 * they share the single hidden `%IteratorPrototype%`. Installing the helpers there
 * once fixes every current and future call site at runtime — far more robust than
 * patching individual `node_modules` files with `Array.from(...)`, which has to be
 * re-applied on every reinstall and silently misses new call sites.
 *
 * Import this module before any wallet-SDK code runs (it's the first import in
 * `config.ts`, which every script loads). On Node 22+ the native helpers already
 * exist and `define()` is a no-op.
 *
 * Typing note: a prototype polyfill is inherently dynamic — `this` is "whatever
 * iterator the method was called on". We type callbacks precisely but keep the
 * `this` context as a generic iterable, which is the honest shape here.
 */

type Mapper<T, R> = (value: T, index: number) => R
type Predicate<T> = (value: T, index: number) => boolean

// %IteratorPrototype%: the shared prototype behind every built-in iterator
// (array, map, set, generator). Reached by walking two prototypes up from an
// array iterator. This is the object Node 22 hangs the native helpers off of.
const IteratorPrototype = Object.getPrototypeOf(
  Object.getPrototypeOf([][Symbol.iterator]()),
) as Record<string, unknown>

function define(name: string, value: (...args: never[]) => unknown): void {
  if (typeof IteratorPrototype[name] !== 'function') {
    Object.defineProperty(IteratorPrototype, name, {
      value,
      writable: true,
      configurable: true,
      enumerable: false,
    })
  }
}

define('map', function* <T, R>(this: Iterable<T>, fn: Mapper<T, R>) {
  let i = 0
  for (const value of this) yield fn(value, i++)
})

define('filter', function* <T>(this: Iterable<T>, fn: Predicate<T>) {
  let i = 0
  for (const value of this) if (fn(value, i++)) yield value
})

define('flatMap', function* <T, R>(
  this: Iterable<T>,
  fn: Mapper<T, R | Iterable<R>>,
) {
  let i = 0
  for (const value of this) {
    const mapped = fn(value, i++)
    if (mapped != null && typeof (mapped as Iterable<R>)[Symbol.iterator] === 'function') {
      yield* mapped as Iterable<R>
    } else {
      yield mapped as R
    }
  }
})

define('take', function* <T>(this: Iterable<T>, limit: number) {
  if (limit <= 0) return
  let count = 0
  for (const value of this) {
    yield value
    if (++count >= limit) return
  }
})

define('drop', function* <T>(this: Iterable<T>, limit: number) {
  let count = 0
  for (const value of this) {
    if (count++ < limit) continue
    yield value
  }
})

define('find', function <T>(this: Iterable<T>, fn: Predicate<T>): T | undefined {
  let i = 0
  for (const value of this) if (fn(value, i++)) return value
  return undefined
})

define('every', function <T>(this: Iterable<T>, fn: Predicate<T>): boolean {
  let i = 0
  for (const value of this) if (!fn(value, i++)) return false
  return true
})

define('some', function <T>(this: Iterable<T>, fn: Predicate<T>): boolean {
  let i = 0
  for (const value of this) if (fn(value, i++)) return true
  return false
})

define('forEach', function <T>(this: Iterable<T>, fn: Mapper<T, void>): void {
  let i = 0
  for (const value of this) fn(value, i++)
})

define('reduce', function <T, A>(
  this: Iterable<T>,
  fn: (acc: A, value: T, index: number) => A,
  initial?: A,
): A {
  let acc = initial as A
  let i = 0
  let hasAcc = arguments.length >= 2
  for (const value of this) {
    if (!hasAcc) {
      acc = value as unknown as A
      hasAcc = true
    } else {
      acc = fn(acc, value, i)
    }
    i++
  }
  if (!hasAcc) throw new TypeError('Reduce of empty iterator with no initial value')
  return acc
})

define('toArray', function <T>(this: Iterable<T>): T[] {
  return Array.from(this)
})
