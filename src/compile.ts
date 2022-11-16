import { cFns } from "./intrinsics";
import { AstNode } from "./types";

export function compile(ast: AstNode){
  const ops = new Set<string>();
  const vars = new Set<string>();
  const free = { ops, vars };

  if (ast.type === 'result') {
    const { value } = ast;
    return { fn: () => value, free };
  }

  let cid = 0;
  const context: unknown[] = [];

  const encodings = new Map<unknown, string>();
  const cache_internal = (value: unknown) => {
    let code = encodings.get(value);
    if (typeof code !== 'undefined') { return code; }
    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean': {
        code = JSON.stringify(value);
        break;
      }
      default: {
        const d = cid++;
        context[d] = value;
        code = `c${d}`
        break;
      }
    }
    encodings.set(value, code);
    return code;
  };

  let aid = 0;
  const argMap = new Map<string, number>();
  const cache_args = (value: string) => {
    let id = argMap.get(value);
    if (typeof id === 'undefined') {
      id = aid++;
      argMap.set(value, id);
    }
    return `a${id}`;
  };

  const walk: (n: AstNode) => string = (node) => {
    switch (node.type) {
      case 'result': return cache_internal(node.value);
      case 'value': {
        vars.add(node.value);
        return cache_args(node.value);
      }
      case 'operator': {
        const { value: { op: { fn, js_inline, name }, args } } = node;
        const arg_list = args.map(walk);

        // Intrinsic functions
        if (typeof fn === 'symbol') { return cFns[fn].call(null, ...arg_list); }

        // Math functions
        if (typeof fn === 'function' && (Math as any)[fn.name] === fn) { return `Math.${fn.name}(${arg_list.join(',')})`; }

        // Inline functions
        if (typeof js_inline === 'function') { return (js_inline as any)(...arg_list); }

        // External functions
        if (typeof fn === 'undefined') {
          ops.add(name);
          return `${cache_args(name)}(${arg_list.join(',')})`;
        }

        // Context functions
        return `${cache_internal(fn)}(${arg_list})`;
      }
    }
  };

  const body = `return ${walk(ast)};`;
  const cvars = context.map((_,i) => `c${i}`);
  const avars = Array.from({ length: aid }, (_, i) => `a${i}`);
  const slots = [...argMap.entries()].sort(([,a],[,b]) => a - b).map(a => a[0]);
   
  const inner = cid === 0 ? new Function(...avars, body) :
    (new Function(...cvars, ...avars, body)).bind(null, ...context);

  const fn: Function = (args: { [key: string]: unknown }) =>
    inner.apply(null, slots.map(a => args[a]));

  return { fn, free };
}