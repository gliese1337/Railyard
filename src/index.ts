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

type StackData = '(' | ',' | ')' | OpInfo;

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

const iFns: { [key in Intrinsic]: (...args: any[]) => unknown } = {
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

type CVal = { t: 'v'; e: string; v: unknown; };
type CXpr = { t: 'x'; e: string; };
type CTrm = CVal | CXpr;

const cval = (e: string, v: unknown) => ({t:'v',e,v} as CVal);
const cxpr = (e: string) => ({t:'x',e} as CXpr);

function iis(e: CTrm, v: unknown) {
  if (e.t === 'x') { return false; }
  return v === e.v;
}

const cFns: { [key in Intrinsic]: (...args: CTrm[]) => CTrm } = {
  [ADD]: (a: CTrm, b: CTrm) => iis(a,0) ? b : iis(b,0) ? a : cxpr(`(${a.e}+${b.e})`),
  [SUB]: (a: CTrm, b: CTrm) => iis(a,0) ? cxpr(`(-${b.e})`) : iis(b,0) ? a : cxpr(`(${a.e}-${b.e})`),
  [MUL]: (a: CTrm, b: CTrm) => iis(a,0) ? a : iis(b,0) ? b : iis(a,1) ? b : iis(b,1) ? a : cxpr(`(${a.e}*${b.e})`),
  [DIV]: (a: CTrm, b: CTrm) => iis(a,0) ? a : iis(b,1) ? a : cxpr(`(${a.e}/${b.e})`),
  [REM]: (a: CTrm, b: CTrm) => cxpr(`(${a.e}%${b.e})`),
  [XOR]: (a: CTrm, b: CTrm) => iis(a,0) ? b : iis(b,0) ? a : cxpr(`(${a.e}^${b.e})`),
  [XNR]: (a: CTrm, b: CTrm) => iis(a,0) ? cxpr(`(~${b.e})`) : iis(b,0) ? cxpr(`(~${a.e})`) : cxpr(`(~(${a.e}^${b.e}))`),
  [AND]: (a: CTrm, b: CTrm) => iis(a,0) ? a : iis(b,0) ? b : cxpr(`(${a.e}&${b.e})`),
  [NND]: (a: CTrm, b: CTrm) => cxpr(`(~(${a.e}&${b.e}))`),
  [ORR]: (a: CTrm, b: CTrm) => iis(a,0) ? b : iis(b,0) ? a : cxpr(`(${a.e}|${b.e})`),
  [NOR]: (a: CTrm, b: CTrm) => cxpr(`(~(${a.e}|${b.e}))`),
  [NEG]: (a: CTrm) => iis(a,0) ? a : cxpr(`(-${a.e})`),
  [INV]: (a: CTrm) => cxpr(`(~${a.e})`),
  [NOT]: (a: CTrm) => cxpr(`(!${a.e})`),
};

function pis(n: AstNode, v: unknown) {
  if (n.type !== 'result') { return false; }
  return n.value === v;
}

const res = (value: unknown) => ({ type: 'result', value } as ResultNode);
const opr = (op: OpInfo, ...args: AstNode[]) => ({ type: 'operator', value: { op, args } } as OpNode);

const pFns: { [key in Intrinsic]: (op: OpInfo, ...args: AstNode[]) => AstNode } = {
  [ADD]: (op: OpInfo, a: AstNode, b: AstNode) => pis(a,0) ? b : pis(b,0) ? a : opr(op,a,b),
  [SUB]: (op: OpInfo, a: AstNode, b: AstNode) => pis(b,0) ? a : opr(op,a,b),
  [MUL]: (op: OpInfo, a: AstNode, b: AstNode) => pis(a,0) ? a : pis(b,0) ? b : pis(a,1) ? b : pis(b,1) ? a : opr(op,a,b),
  [DIV]: (op: OpInfo, a: AstNode, b: AstNode) => pis(a,0) ? res(0) : pis(b,1) ? a : opr(op,a,b),
  [REM]: (op: OpInfo, a: AstNode, b: AstNode) => opr(op,a,b),
  [XOR]: (op: OpInfo, a: AstNode, b: AstNode) => pis(a,0) ? b : pis(b,0) ? a : opr(op,a,b),
  [XNR]: (op: OpInfo, a: AstNode, b: AstNode) => opr(op,a,b),
  [AND]: (op: OpInfo, a: AstNode, b: AstNode) => pis(a,0) ? a : pis(b,0) ? b : opr(op,a,b),
  [NND]: (op: OpInfo, a: AstNode, b: AstNode) => opr(op,a,b),
  [ORR]: (op: OpInfo, a: AstNode, b: AstNode) => pis(a,0) ? b : pis(b,0) ? a : opr(op,a,b),
  [NOR]: (op: OpInfo, a: AstNode, b: AstNode) => opr(op,a,b),
  [NEG]: (op: OpInfo, a: AstNode) => pis(a,0) ? a : opr(op,a),
  [INV]: (op: OpInfo, a: AstNode) => opr(op,a),
  [NOT]: (op: OpInfo, a: AstNode) => opr(op,a),
};

function * handle_op(stack: StackData[], { precedence, associativity }: InfixInfo) {
  if (associativity === 'right') {
    // If the operator is right associative, we stop when we find another operator of
    // lower *or equal* precedence. To avoid multiple checks in the loop, we can 
    // achieve that behavior by simply incrementing the target precedence here,
    // such that < stays < and <= becomes <.
    precedence++;
  }

  while(stack.length){
      const top = stack[stack.length-1];
      // Stop if we run out of operators
      if (typeof top === 'string') break;
      // Stop if we find an operator with lower precedence
      // Functions have highest precedence.
      if (top.type === 'infix' && top.precedence < precedence) break;
      stack.length--;
      yield { type: "operator", value: top } as Token;
  }
}

function * handle_implicit(stack: StackData[], opInfo: OpInfo | null, error: string) {
  if (!opInfo || opInfo.type !== 'infix') throw new Error(error);
  yield * handle_op(stack, opInfo);
  stack.push(opInfo);
}

function * match_paren(stack: StackData[], error: string) {
  if(stack.length === 0) throw new Error(error);

  while(stack[stack.length-1] !== "(") {
    yield { type: "operator", value: stack.pop() } as Token;
    if(stack.length === 0) throw new Error(error);
  }
}

function extract_impl(op: OpInfo) {
  if (typeof op.fn === 'symbol') { return iFns[op.fn]; }
  if (typeof op.fn !== 'function') {
    throw new Error(`No implementation for operator ${ op.name }`);
  }
  
  return op.fn;
}

export class Railyard {
  private operators: Map<string, InfixInfo> = new Map();
  private functions: Map<string, FnInfo> = new Map();
  private wrap: (x: string)=> unknown = x => parseFloat(x);
  private implicitOp: string | null = null;
  private unaryAsPrefix: boolean = true;

  public register(opInfo: OpInfo) {
    if (opInfo.type === 'infix') {
      this.operators.set(opInfo.name, opInfo);
    } else {
      this.functions.set(opInfo.name, opInfo);
    }
    return this;
  }

  public lookup(fn: (x: string) => unknown) {
    this.wrap = fn;
    return this;
  }

  public setImplicitOp(op: string | null) {
    this.implicitOp = op;
    return this;
  }

  public unaryFnAsPrefix(flag: boolean) {
    this.unaryAsPrefix = flag;
    return this;
  }

  public * parseToRPN(tokens: Iterable<string>): Generator<Token> {
    const stack: StackData[] = [];
    const { operators, functions } = this;
    const implicit = this.implicitOp && operators.get(this.implicitOp) || null;
    let expect = 'value';

    for(const token of tokens) { // while there are tokens to be read, read a token
      switch (token) {
        case '(': {
          if (expect === 'operator')
            yield * handle_implicit(stack, implicit, 'Expected operator, found left paren.');
          // If the token is a left parenthesis, then push it onto the stack.
          stack.push('(');
          expect = 'value';
          continue;
        }
        case ',': {
          if (expect === 'value') throw new Error('Expected value, found comma.');
          // If the token is an argument separator:
          // Pop operators to the output until we find a left parenthesis.
          yield * match_paren(stack, "Found comma outside of parentheses");
          expect = 'value';
          continue;
        }
        case ')': {
          // If the token is a right parenthesis:
          // Pop operators to the output until we find a left parenthesis.
          yield * match_paren(stack, "Mismatched Parentheses");

          stack.length--; // Discard the left parenthesis.

          // If the token at the top of the stack is a function token, pop it onto the output queue.
          if (stack.length > 0) {
            const opInfo = stack[stack.length-1];
            if (typeof opInfo !== 'string' && opInfo.type === 'function') {
              yield { type: 'operator', value: opInfo };
              stack.length--;
            }
          }

          continue;
        }
      }

      const infixInfo = operators.get(token);
      if (infixInfo) {
          if (expect === 'value'){
            if (!functions.has(token)) throw new Error(`Expected value, found operator ${ infixInfo.name }`);
          } else {
            // If the token is a non-function operator then:
            // pop previous operators from the stack until we reach one with lower precedence
            yield * handle_op(stack, infixInfo);
            // then push the operator onto the stack
            stack.push(infixInfo);
            expect = 'value';
            continue;
          }
      }

      // Handle functions and immediate values
      if (expect === 'operator')
        yield * handle_implicit(stack, implicit, `Expected operator, found ${ token }`);

      const fnInfo = functions.get(token);
      if (fnInfo) {
        // push functions onto the stack
        stack.push(fnInfo);
        expect = fnInfo.arity > 1 || !this.unaryAsPrefix ? 'args' : 'value';
        continue;
      }

      // If the token is a value, push it directly to the output queue.
      if (expect === 'args')
        throw new Error(`Expected argument list, found ${ token }`);
      yield { type: "value", value: token } as Token;

      expect = "operator";
    }

    if (expect === 'value') throw new Error('Missing values');
    if (expect === 'error') throw new Error('Missing function arguments');

    // while there are still operators on the stack, pop them to the output queue
    while(stack.length){
      const token = stack.pop();
      if(token === "("){
        throw new Error("Unbalanced Open Parentheses");
      }

      yield { type: "operator", value: token } as Token;
    }
  }

  private _interpret<T>(tokens: Iterable<string>, impl: (op: OpInfo) => (...args: T[]) => T, wrap: (a: string) => T) {
    const vstack: T[] = [];
    for(const token of this.parseToRPN(tokens)){
      if(token.type === "operator"){
        const opInfo = token.value;
        const arity = opInfo.type === 'infix' ? 2 : opInfo.arity;
        if(vstack.length < arity){
          throw new Error("Missing Values");
        }
        const args = vstack.slice(vstack.length-arity);
        vstack.length -= arity;
        vstack.push(impl(opInfo)(...args));
      } else {
        vstack.push(wrap(token.value));
      }
    }

    if(vstack.length === 0){
      throw new Error("Empty Formula");
    }

    if(vstack.length > 1){
      throw new Error("Missing Operators");
    }

    return vstack[0];
  }

  public parseToAST(tokens: Iterable<string>){
    return this._interpret<AstNode>(
      tokens,
      (op) => (...args: AstNode[]) => ({ type: "operator", value: { op, args } }),
      (value: string) => ({ type: "value", value }),
    );
  }

  public parseToSExpr(tokens: Iterable<string>){
    return this._interpret<string>(
      tokens,
      (op) => (...args: string[]) => `(${op.name} ${args.join(' ') })`,
      (value: string) => value,
    );
  }

  public interpret(tokens: Iterable<string>){
    return this._interpret<unknown>(tokens, extract_impl, this.wrap);
  }

  public partial(tokens: Iterable<string>){
    const { wrap } = this;
    const missingImpls = new Set<string>();
    const missingVals = new Set<string>();
    const impl = (op: OpInfo) => (...args: AstNode[]) => {
      let { fn } = op;

      if (typeof fn === 'undefined') {
        missingImpls.add(op.name);
        return opr(op, ...args);
      }

      const can_eval = args.every(({ type }) => type === 'result');

      if (typeof fn === 'symbol') {
        if (!can_eval) { return pFns[fn](op, ...args); }
        fn = iFns[fn];
      }

      if (can_eval) {
        const arg_vals = args.map(a => a.value);
        return res(fn.apply(null, arg_vals as any));
      }
      return opr(op, ...args);
    };

    const val = (value: string) => {
      if (missingVals.has(value)) {
        return { type: "value", value } as ValNode;
      }
      try {
        return { type: 'result', value: wrap(value) } as ResultNode;
      } catch(_) {
        missingVals.add(value);
        return { type: "value", value } as ValNode;
      }
    };

    return {
      ast: this._interpret<AstNode>(tokens, impl, val),
      free: {
        ops: missingImpls,
        vars: missingVals,
      }
    };
  }

  public compile(tokens: Iterable<string>){
    const { wrap } = this;
    const missingImpls = new Set<string>();
    const missingVals = new Set<string>();
    const idmap = new Map<string, number>();

    let id = 0;
    const context: { [key: number]: unknown } = {};

    const cache = (result: unknown, value: string) => {
      switch (typeof result) {
        case 'string':
        case 'number':
        case 'boolean':
          return cval(JSON.stringify(result), result);
        default: {
          const d = id++;
          idmap.set(value, d);
          context[d] = result;
          return cval(`c[${d}]`, result);
        }
      }
    };

    const impl = (op: OpInfo) => (...args: CTrm[]) => {
      let { fn } = op;

      if (typeof fn === 'undefined') {
        missingImpls.add(op.name);
        const arg_list = args.map(({e}) => e).join(',');
        return cxpr(`a[${JSON.stringify(op.name)}](${arg_list})`);
      }

      const can_eval = args.every(a => a.t === 'v')

      if (typeof fn === 'symbol') {
        if (!can_eval) { return cFns[fn].call(null, ...args); }
        fn = iFns[fn];
      }

      if (can_eval) {
        const arg_vals = (args as CVal[]).map(({v}) => v);
        cache(fn.apply(null, arg_vals as any), null as any);
      }

      const arg_list = args.map(({e}) => e).join(',');
      if ((Math as any)[fn.name] === fn) {
        return cxpr(`Math.${fn.name}(${arg_list})`);
      }

      let fid = idmap.get(op.name);
      if (typeof fid === 'undefined') {
        fid = id++;
        idmap.set(op.name, fid);
        context[fid] = fn;
      }

      return cxpr(`c[${fid}](${arg_list})`);
    };

    const val: (v: string) => CTrm = (value: string) => {
      if (missingVals.has(value)) {
        return cxpr(`a[${JSON.stringify(value)}]`);
      }
      
      const d = idmap.get(value);
      if (typeof d === 'number') {
        return cval(`c[${d}]`, context[d]);
      }

      try {
        return cache(wrap(value), value);
      } catch(_) {
        missingVals.add(value);
        return cxpr(`a[${JSON.stringify(value)}]`);
      }
    };

    const expr = this._interpret<CTrm>(tokens, impl, val).e;

    let fn: Function;
    const body = `return ${expr};`;
    console.log(body);
    if (missingVals.size + missingImpls.size === 0) {
      if (id === 0) { fn = new Function(body); }
      else { fn = (new Function('c', body)).bind(null, context); }
    } else {
      if (id === 0) { fn = new Function('a', body); }
      else { fn = (new Function('c', 'a', body)).bind(null, context); }
    }

    return {
      fn,
      free: {
        ops: missingImpls,
        vars: missingVals,
      }
    };
  }
}
