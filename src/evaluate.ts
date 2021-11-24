import { iFns, pFns } from "./intrinsics";
import { AstNode, res } from "./types";

export function partial(ast: AstNode, wrap: (x: string) => unknown){
  const mvals = new Set<string>();
  const eval_node: (n: AstNode) => AstNode = (node) => {
    switch (node.type) {
      case 'result': return node;
      case 'value': {
        if (mvals.has(node.value)) { return node; }
        try { return res(wrap(node.value)); }
        catch (_) { mvals.add(node.value); }
        return node;
      }
      case 'operator': {
        const { value } = node;
        const { op, args: params } = value;

        // Replace original arguments with
        // partially-evaluated arguments.
        const args = params.map(eval_node);
        value.args = args;

        let { fn } = op;

        // Unimplemented operations
        if (typeof fn === 'undefined') { return node; }

        // If all arguments are fully evaluated,
        // we can continue evaluation.
        if (args.every(a => a.type === 'result')) {
          const arg_vals = args.map(a => a.value);
          if (typeof fn === 'symbol') { fn = iFns[fn]; }
          return res(fn.apply(null, arg_vals as any));
        }

        // If we can't evaluate, try identity transformations
        return (typeof fn === 'symbol') ? pFns[fn](node, ...args) : node;
      }
    }
  };

  return eval_node(ast);
}
