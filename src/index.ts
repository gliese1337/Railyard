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

/* Intrinsic Implementations */

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

/* Compilation Functions */

const cFns: { [key in Intrinsic]: (...args: string[]) => string } = {
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

const res = (value: unknown) => ({ type: 'result', value } as ResultNode);
const opr = (op: OpInfo, ...args: AstNode[]) => ({ type: 'operator', value: { op, args } } as OpNode);
const negInfo: FnInfo = { type: 'function', name: 'neg', arity: 1, fn: NEG };

// At least one argument will always be unevaluable
const pFns: { [key in Intrinsic]: (op: OpNode, ...args: AstNode[]) => AstNode } = {
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
      (op) => (...args) => ({ type: "operator", value: { op, args } }),
      value => ({ type: "value", value }),
    );
  }

  public parseToSExpr(tokens: Iterable<string>){
    return this._interpret<string>(
      tokens,
      (op) => (...args) => `(${op.name} ${args.join(' ') })`,
      value => value,
    );
  }

  public interpret(tokens: Iterable<string>){
    return this._interpret<unknown>(tokens, extract_impl, this.wrap);
  }

  private _partial(tokens: Iterable<string>){
    const { wrap } = this;
    const ast = this.parseToAST(tokens);

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

  public partial(tokens: Iterable<string>){
    const ast = this._partial(tokens);
    const ops = new Set<string>();
    const vars = new Set<string>();

    (function walk(node: AstNode) {
      switch (node.type) {
        case 'value':
          vars.add(node.value);
          break;
        case 'operator': {
          const { op, args } = node.value;
          args.forEach(walk);
          if (typeof op.fn === 'undefined') {
            ops.add(op.name);
          }
        }
      }
    })(ast);
    
    return { ast, free: { ops, vars } };
  }

  public compile(tokens: Iterable<string>){
    const { ast, free } = this.partial(tokens);
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
        case 'value': return `a[${JSON.stringify(node.value)}]`;
        case 'operator': {
          const { value: { op: { fn, name }, args } } = node;
          const arg_list = args.map(walk);

          // External functions
          if (typeof fn === 'undefined') { return `a[${JSON.stringify(name)}](${arg_list.join(',')})`; }

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
    if (free.ops.size + free.vars.size === 0) {
      if (id === 0) { fn = new Function(body); }
      else { fn = (new Function('c', body)).bind(null, context); }
    } else {
      if (id === 0) { fn = new Function('a', body); }
      else { fn = (new Function('c', 'a', body)).bind(null, context); }
    }

    return { fn, free };
  }
}
