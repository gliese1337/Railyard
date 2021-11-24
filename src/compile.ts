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

  let id = 0;
  const context: unknown[] = [];

  const encodings = new Map<unknown, string>();
  const cache = (value: unknown) => {
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
        const d = id++;
        context[d] = value;
        code = `c[${d}]`
        break;
      }
    }
    encodings.set(value, code);
    return code;
  };

  const walk: (n: AstNode) => string = (node) => {
    switch (node.type) {
      case 'result': return cache(node.value);
      case 'value': {
        vars.add(node.value);
        return `a[${JSON.stringify(node.value)}]`;
      }
      case 'operator': {
        const { value: { op: { fn, name }, args } } = node;
        const arg_list = args.map(walk);

        // External functions
        if (typeof fn === 'undefined') {
          ops.add(name);
          return `a[${JSON.stringify(name)}](${arg_list.join(',')})`;
        }

        // Intrinsic functions
        if (typeof fn === 'symbol') { return cFns[fn].call(null, ...arg_list); }
        
        // Math functions
        if ((Math as any)[fn.name] === fn) { return `Math.${fn.name}(${arg_list.join(',')})`; }

        // Context functions
        return `${cache(fn)}(${arg_list})`;
      }
    }
  };

  let fn: Function;
  const body = `return ${walk(ast)};`;
  if (ops.size + vars.size === 0) {
    if (id === 0) { fn = new Function(body); }
    else { fn = (new Function('c', body)).bind(null, context); }
  } else {
    if (id === 0) { fn = new Function('a', body); }
    else { fn = (new Function('c', 'a', body)).bind(null, context); }
  }

  return { fn, free };
}