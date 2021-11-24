export const ADD: unique symbol = Symbol();
export const SUB: unique symbol = Symbol();
export const MUL: unique symbol = Symbol();
export const DIV: unique symbol = Symbol();
export const REM: unique symbol = Symbol();

export const XOR: unique symbol = Symbol();
export const XNR: unique symbol = Symbol();
export const AND: unique symbol = Symbol();
export const NND: unique symbol = Symbol();
export const ORR: unique symbol = Symbol();
export const NOR: unique symbol = Symbol();

export const NEG: unique symbol = Symbol();
export const INV: unique symbol = Symbol();
export const NOT: unique symbol = Symbol();

export type Intrinsic =
  typeof ADD | typeof SUB | typeof MUL | typeof DIV | typeof REM |
  typeof XOR | typeof XNR | typeof AND | typeof NND | typeof ORR | typeof NOR |
  typeof NEG | typeof INV | typeof NOT;

export type InfixInfo = {
  type: 'infix'
  name: string,
  precedence: number;
  associativity: "left" | "right";
  fn?: Intrinsic | ((a: any, b: any) => unknown);
};

export type FnInfo = {
  type: 'function'
  name: string,
  arity: number;
  fn?: Intrinsic | ((...args: any[]) => unknown);
};

export type OpInfo = InfixInfo | FnInfo;

export type ValToken = {
  type: "value";
  value: string;
};

export type OpToken = {
  type: "operator";
  value: OpInfo;
};

export type Token = ValToken | OpToken;

export type OpNode = {
  type: "operator";
  value: {
    op: OpInfo;
    args: AstNode[];
  }
};

export type ValNode = {
  type: "value";
  value: string;
};

export type ResultNode = {
  type: "result";
  value: unknown;
};

export type AstNode = OpNode | ValNode | ResultNode;

export const res = (value: unknown) => ({ type: 'result', value } as ResultNode);
export const val = (value: string) => ({ type: 'value', value } as ValNode);
export const opr = (op: OpInfo, ...args: AstNode[]) => ({ type: 'operator', value: { op, args } } as OpNode);
