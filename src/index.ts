export type InfixInfo = {
  type: 'infix'
  name: string,
  precedence: number;
  associativity: "left" | "right";
  fn?: (a: any, b: any) => unknown;
};

export type FnInfo = {
  type: 'function'
  name: string,
  arity: number;
  fn?: (...args: any[]) => unknown;
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
    return this._interpret(tokens, extract_impl, this.wrap);
  }

  public partial(tokens: Iterable<string>){
    const { wrap } = this;
    const missingImpls = new Set<string>();
    const missingVals = new Set<string>();
    const impl = (op: OpInfo) => (...args: AstNode[]) => {
      if (typeof op.fn !== 'function') {
        missingImpls.add(op.name);
        return { type: "operator", value: { op, args } } as OpNode;
      }
      if (args.every(({ type }) => type === 'result')) {
        const arg_vals = args.map(a => a.value);
        return { type: 'result', value: op.fn.apply(null, arg_vals as any) } as ResultNode;
      }
      return { type: "operator", value: { op, args } } as OpNode;
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
    const context: { [key: number]: unknown } = {};
    const idmap = new Map<string, number>();
    let id = 0;

    const impl = (op: OpInfo) => (...args: string[]) => {
      if (typeof op.fn !== 'function') {
        missingImpls.add(op.name);
        return `a[${JSON.stringify(op.name)}](${args.join(',')})`;
      }
      let fid = idmap.get(op.name);
      if (typeof fid === 'undefined') {
        fid = id++;
        idmap.set(op.name, fid);
        context[fid] = op.fn;
      }
      if (args.every(a => a[0] === 'c')) {
        const arg_vals = args.map(a => context[a.substring(2, a.length-1) as unknown as number]);
        const result = op.fn.apply(null, arg_vals as any);
        const rid = id++;
        context[rid] = result;
        return `c[${rid}]`;
      }
      return `c[${fid}](${args.join(',')})`;
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

    const body = `return ${this._interpret<string>(tokens, impl, val)};`;
    let fn = (new Function('c', 'a', body)).bind(null, context);
    if (missingVals.size + missingImpls.size === 0) {
      const result = fn();
      fn = () => result;
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
