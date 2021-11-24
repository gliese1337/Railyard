import { Intrinsic, ADD, SUB, MUL, DIV, REM, XOR, XNR, AND, NND, ORR, NOR, NEG, INV, NOT, AstNode, OpNode, FnInfo, opr, res } from "./types";

/* Intrinsic Implementations */

export const iFns: { [key in Intrinsic]: (...args: any[]) => unknown } = {
  [ADD]: (a: number, b: number) => a + b,
  [SUB]: (a: number, b: number) => a - b,
  [MUL]: (a: number, b: number) => a * b,
  [DIV]: (a: number, b: number) => a / b,
  [REM]: (a: number, b: number) => a % b,
  [XOR]: (a: number, b: number) => a ^ b,
  [XNR]: (a: number, b: number) => ~(a ^ b),
  [AND]: (a: number, b: number) => a & b,
  [NND]: (a: number, b: number) => ~(a & b),
  [ORR]: (a: number, b: number) => a | b,
  [NOR]: (a: number, b: number) => ~(a | b),
  [NEG]: (a: number) => -a,
  [INV]: (a: number) => ~a,
  [NOT]: (a: number) => !a,
};

/* Compilation Functions */

export const cFns: { [key in Intrinsic]: (...args: string[]) => string } = {
  [ADD]: (a: string, b: string) => `(${a}+${b})`,
  [SUB]: (a: string, b: string) => `(${a}-${b})`,
  [MUL]: (a: string, b: string) => `(${a}*${b})`,
  [DIV]: (a: string, b: string) => `(${a}/${b})`,
  [REM]: (a: string, b: string) => `(${a}%${b})`,
  [XOR]: (a: string, b: string) => `(${a}^${b})`,
  [XNR]: (a: string, b: string) => `(~(${a}^${b}))`,
  [AND]: (a: string, b: string) => `(${a}&${b})`,
  [NND]: (a: string, b: string) => `(~(${a}&${b}))`,
  [ORR]: (a: string, b: string) => `(${a}|${b})`,
  [NOR]: (a: string, b: string) => `(~(${a}|${b}))`,
  [NEG]: (a: string) => `(-${a})`,
  [INV]: (a: string) => `(~${a})`,
  [NOT]: (a: string) => `(!${a})`,
};


/* Partial Evaluation Functions */

function is(n: AstNode, v: unknown) {
  if (n.type !== 'result') { return false; }
  return n.value === v;
}

const negInfo: FnInfo = { type: 'function', name: 'neg', arity: 1, fn: NEG };

// At least one argument will always be unevaluable
export const pFns: { [key in Intrinsic]: (op: OpNode, ...args: AstNode[]) => AstNode } = {
  [ADD]: (op: OpNode, a: AstNode, b: AstNode) => is(a,0) ? b : is(b,0) ? a : op,
  [SUB]: (op: OpNode, a: AstNode, b: AstNode) => is(b,0) ? a : is(a,0) ? (b.type === 'result' ? res(-(b.value as any)) : opr(negInfo, b)) : op,
  [MUL]: (op: OpNode, a: AstNode, b: AstNode) => is(a,0) ? a : is(b,0) ? b : is(a,1) ? b : is(b,1) ? a : op,
  [DIV]: (op: OpNode, a: AstNode, b: AstNode) => is(a,0) ? res(0) : is(b,1) ? a : op,
  [REM]: (op: OpNode,_a: AstNode,_b: AstNode) => op,
  [XOR]: (op: OpNode, a: AstNode, b: AstNode) => is(a,0) ? b : is(b,0) ? a : op,
  [XNR]: (op: OpNode,_a: AstNode,_b: AstNode) => op,
  [AND]: (op: OpNode, a: AstNode, b: AstNode) => is(a,0) ? a : is(b,0) ? b : op,
  [NND]: (op: OpNode, a: AstNode, b: AstNode) => is(a,0) ? res(~0) : is(b,0) ? res(~0) : op,
  [ORR]: (op: OpNode, a: AstNode, b: AstNode) => is(a,0) ? b : is(b,0) ? a : op,
  [NOR]: (op: OpNode, a: AstNode, b: AstNode) => is(a,~0) ? res(0) : is(b,~0) ? res(0) : op,
  // These only have one argument, so we can't do anything
  [NEG]: (op: OpNode,_a: AstNode) => op,
  [INV]: (op: OpNode,_a: AstNode) => op,
  [NOT]: (op: OpNode,_a: AstNode) => op,
};
