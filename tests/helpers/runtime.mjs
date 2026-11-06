import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

// Run real TypeScript modules with explicit, isolated substitutes for OS/UI APIs.
// No Electron, user store, calendar, active-window probe or network is started.
export function loadTypeScript(relativePath, mocks = {}, globals = {}) {
  const filename = path.resolve(relativePath)
  const source = readFileSync(filename, 'utf8').replaceAll(
    'import.meta.url', JSON.stringify(pathToFileURL(filename).href),
  )
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  })
  const nativeRequire = createRequire(filename)
  const require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id)
  const module = { exports: {} }
  const run = vm.runInNewContext(`(function(require, module, exports) {\n${outputText}\n})`, {
    console, process: { env: {}, platform: process.platform },
    setTimeout, clearTimeout, setInterval, clearInterval, ...globals,
  }, { filename })
  run(require, module, module.exports)
  return module.exports
}

// A small effect runner: tests drive real hooks/components without a browser.
export function hookRuntime() {
  const slots = []
  let cursor = 0
  let effects = []
  let dirty = false
  let render
  let output
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))
  const react = {
    useState(initial) {
      const i = cursor++
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[i].value, (next) => {
        const value = typeof next === 'function' ? next(slots[i].value) : next
        if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true }
      }]
    },
    useRef(initial) {
      const i = cursor++
      slots[i] ??= { current: initial }
      return slots[i]
    },
    useCallback(callback, deps) {
      const i = cursor++
      if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: callback, deps }
      return slots[i].value
    },
    useEffect(effect, deps) {
      const i = cursor++
      if (!slots[i] || changed(slots[i].deps, deps)) {
        const previous = slots[i]
        effects.push(() => {
          previous?.cleanup?.()
          slots[i] = { deps, cleanup: effect() }
        })
      }
    },
  }
  function flush() {
    for (let pass = 0; pass < 20; pass++) {
      cursor = 0
      dirty = false
      effects = []
      output = render()
      effects.forEach((effect) => effect())
      if (!dirty) return output
    }
    throw new Error('Hook render did not settle')
  }
  return {
    react,
    render(callback) { render = callback; return flush() },
    flush,
    unmount() { slots.forEach((slot) => slot?.cleanup?.()) },
  }
}

export function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

export const settle = () => new Promise((resolve) => setImmediate(resolve))
