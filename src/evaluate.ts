import { interpret } from "./interpret";
import { iFns, pFns } from "./intrinsics";
import { AstNode, OpInfo, opr, res, Token, val, ValNode } from "./types";

export function partial(tokens: Iterable<Token>, wrap: (x: string) => unknown) {
  
  const mvals = new Map<string, ValNode>();

  const val2node = (value: string) => {
    let node: AstNode | undefined = mvals.get(value)
    if (node) { return node; }
    try { return res(wrap(value)); }
    catch (_) {
      node = val(value);
      mvals.set(value, node);
    }
    return node;
  };

  const partial_impl = (op: OpInfo, ...args: AstNode[]) => {
    let { fn, partial } = op;

    const node =  opr(op, ...args);

    // If all arguments are fully evaluated, we can continue evaluation.
    if (typeof fn !== 'undefined' && args.every(a => a.type === 'result')) {
      const arg_vals = args.map(a => a.value);
      if (typeof fn === 'symbol') { fn = iFns[fn]; }
      return res(fn.apply(null, arg_vals as any));
    }

    // If we can't evaluate, try identity transformations
    if (typeof fn === 'symbol') { return pFns[fn](node, ...args); }
    if (typeof partial === 'function') { return (partial as any)(node, ...args); }
    
    // Unimplemented operations
    return node;
  };
  
  return interpret<AstNode>(tokens, val2node, partial_impl);
}
