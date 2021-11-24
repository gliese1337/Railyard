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

function iis(c: { [key: number]: unknown }, e: string, v: unknown) {
  if (e[0] !== 'c') { return false; }
  return v === c[e.substring(2, e.length-1) as unknown as number];
}

const cFns: { [key in Intrinsic]: (c: { [key: number]: unknown }, ...args: string[]) => string } = {
  [ADD]: (c: { [key: number]: unknown }, a: string, b: string) => iis(c,a,0) ? b : iis(c,b,0) ? a : `(${a}+${b})`,
  [SUB]: (c: { [key: number]: unknown }, a: string, b: string) => iis(c,a,0) ? (iis(c,b,0) ? '0' : `(-${b})`) : (iis(c,b,0) ? a : `(${a}-${b})`),
  [MUL]: (c: { [key: number]: unknown }, a: string, b: string) => (iis(c,a,0) || iis(c,b,0)) ? '0' : iis(c,a,1) ? b : iis(c,b,1) ? a : `(${a}*${b})`,
  [DIV]: (c: { [key: number]: unknown }, a: string, b: string) => iis(c,a,0) ? '0' : iis(c,b,1) ? a : `(${a}/${b})`,
  [REM]: (_: { [key: number]: unknown }, a: string, b: string) => `(${a}%${b})`,
  [XOR]: (c: { [key: number]: unknown }, a: string, b: string) => iis(c,a,0) ? b : iis(c,b,0) ? a : `(${a}^${b})`,
  [XNR]: (c: { [key: number]: unknown }, a: string, b: string) => iis(c,a,0) ? `(~${b})` : iis(c,b,0) ? `(~${a})` : `(~(${a}^${b}))`,
  [AND]: (c: { [key: number]: unknown }, a: string, b: string) => (iis(c,a,0) || iis(c,b,0)) ? '0' : `(${a}&${b})`,
  [NND]: (_: { [key: number]: unknown }, a: string, b: string) => `(~(${a}&${b}))`,
  [ORR]: (c: { [key: number]: unknown }, a: string, b: string) => iis(c,a,0) ? b : iis(c,b,0) ? a : `(${a}|${b})`,
  [NOR]: (_: { [key: number]: unknown }, a: string, b: string) => `(~(${a}|${b}))`,
  [NEG]: (c: { [key: number]: unknown }, a: string) => iis(c,a,0) ? '0' : `(-${a})`,
  [INV]: (_: { [key: number]: unknown }, a: string) => `(~${a})`,
  [NOT]: (_: { [key: number]: unknown }, a: string) => `(!${a})`,
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
  [MUL]: (op: OpInfo, a: AstNode, b: AstNode) => (pis(a,0) || pis(b,0)) ? res(0) : pis(a,1) ? b : pis(b,1) ? a : opr(op,a,b),
  [DIV]: (op: OpInfo, a: AstNode, b: AstNode) => pis(a,0) ? res(0) : pis(b,1) ? a : opr(op,a,b),
  [REM]: (op: OpInfo, a: AstNode, b: AstNode) => opr(op,a,b),
  [XOR]: (op: OpInfo, a: AstNode, b: AstNode) => pis(a,0) ? b : pis(b,0) ? a : opr(op,a,b),
  [XNR]: (op: OpInfo, a: AstNode, b: AstNode) => opr(op,a,b),
  [AND]: (op: OpInfo, a: AstNode, b: AstNode) => (pis(a,0) || pis(b,0)) ? res(0) : opr(op,a,b),
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
    let context: { [key: number]: unknown } = {};

    const impl = (op: OpInfo) => (...args: string[]) => {
      let { fn } = op;

      if (typeof fn === 'undefined') {
        missingImpls.add(op.name);
        return `a[${JSON.stringify(op.name)}](${args.join(',')})`;
      }

      const can_eval = args.every(a => a[0] === 'c')

      if (typeof fn === 'symbol') {
        if (!can_eval) { return cFns[fn].call(null, context, ...args); }
        fn = iFns[fn];
      }

      if (can_eval) {
        const arg_vals = args.map(a => context[a.substring(2, a.length-1) as unknown as number]);
        const result = fn.apply(null, arg_vals as any);
        const rid = id++;
        context[rid] = result;
        return `c[${rid}]`;
      }

      if ((Math as any)[fn.name] === fn) {
        return `Math.${fn.name}(${args.join(',')})`;
      }

      let fid = idmap.get(op.name);
      if (typeof fid === 'undefined') {
        fid = id++;
        idmap.set(op.name, fid);
        context[fid] = fn;
      }

      return `(c[${fid}](${args.join(',')}))`;
    };

    const val = (value: string) => {
      if (missingVals.has(value)) {
        return `a[${JSON.stringify(value)}]`;
      }
      
      if (idmap.has(value)) {
        return `c[${idmap.get(value) as number}]`;
      }

      try {
        const result = wrap(value);
        const vid = id++;
        idmap.set(value, vid);
        context[vid] = result;
        return `c[${vid}]`;
      } catch(_) {
        missingVals.add(value);
        return `a[${JSON.stringify(value)}]`;
      }
    };

    let expr = this._interpret<string>(tokens, impl, val);

    // Substitute literal values into the body expression,
    // and keep track of which values cannot be substituted.
    const used = new Set<number>();
    expr = expr.replace(/c\[(\d+)]/g,
      (m, d) => {
        const v = context[d];
        switch (typeof v) {
          case 'string':
          case 'number':
          case 'boolean':
            return JSON.stringify(v);
          default:
            used.add(+d);
            return m;
        }
      }
    );

    // Release memory for values that don't
    // need to be kept in the context.
    if (used.size === 0) {
      context = null as any;
    } else for (id--; id >= 0; id--) {
      if (!used.has(id)) { delete context[id]; }
    }

    let fn: Function;
    const body = `return ${expr};`;
    console.log(body);
    if (missingVals.size + missingImpls.size === 0) {
      if (context === null) { fn = new Function(body); }
      else { fn = (new Function('c', body)).bind(null, context); }
    } else {
      if (context === null) { fn = new Function('a', body); }
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
