export type OpData = {
  name: string,
  precedence: number;
  arity: number;
  associativity: "left" | "right";
  fn?: (a: unknown, b: unknown) => unknown;
};

type TType = "value" | "operator";
export type Token = {
  type: "value";
  value: string;
} | {
  type: "operator";
  value: OpData;
};

export type AstNode = {
  type: "operator";
  value: {
    op: OpData;
    args: AstNode[];
  }
} | {
  type: "value";
  value: string;
};

function * handle_op(stack: string[], operators: Map<string, OpData>, { precedence, associativity }: OpData) {
  if (associativity === 'right') {
    // If the operator is right associative, we stop when we find another operator of
    // lower *or equal* precedence. To avoid multiple checks in the loop, we can 
    // achieve that behavior by simply incrementing the target precedence here,
    // such that < stays < and <= becomes <.
    precedence++;
  }

  while(stack.length){
      const top = stack[stack.length-1];
      if (top === "(") break; // parens have the lowest precedence
      const opInfo = operators.get(top) as OpData;
      if (opInfo.precedence < precedence) break;
      stack.length--;
      yield { type: "operator", value: opInfo } as Token;
  }
}

function * handle_implicit(stack: string[], operators: Map<string, OpData>, token: string | null) {
  if (token !== null && operators.has(token)) {
    yield * handle_op(stack, operators, operators.get(token) as OpData);
    stack.push(token);
  } else {
    throw new Error("Missing Operator");
  }
}

function * match_paren(stack: string[], operators: Map<string, OpData>) {
  if(stack.length === 0) throw new Error("Mismatched Parentheses");

  while(stack[stack.length-1] !== "(") {
    yield { type: "operator", value: operators.get(stack.pop() as string) } as Token;
    if(stack.length === 0) throw new Error("Mismatched Parentheses");
  }

  stack.pop(); // discard left bracket
}

function extract_impl(op: OpData) {
  if (typeof op.fn !== 'function') {
    throw new Error(`No implementation for operator ${ op.name }`);
  }
  
  return op.fn;
}

export class Railyard {
  private operators: Map<string, OpData> = new Map();
  private wrap: (x: string)=> unknown = x => parseFloat(x);
  private implicitOp: string | null = null;

  public register(
    op: string,
    precedence: number,
    associativity: "left" | "right",
    fn?: (a: unknown, b: unknown) => unknown,
  ) {
    this.operators.set(op, { name: op, precedence, associativity, arity: 2, fn });
  }

  public lookup(fn: (x: string) => unknown) {
    this.wrap = fn;
  }

  public setImplicitOp(op: string) {
    this.implicitOp = op;
  }

  public * parseToRPN(tokens: Iterable<string>): Generator<Token> {
    const stack: string[] = [];
    const { operators } = this;

    let expect: TType = "value";

    for(const token of tokens){ // while there are tokens to be read, read a token
      if (token === "(") {
        if (expect !== "value") {
          yield * handle_implicit(stack, operators, this.implicitOp);
        }
        // if the token is a left bracket, just push it
        stack.push(token);
        expect = "value";
      } else if (token === ")") {
        // TODO: Previous operator could have been postfix
        if (expect !== "operator") throw new Error("Missing Value");

        // if the token is a right bracket, pop operators until the matching paren
        yield * match_paren(stack, operators);
      } else if (operators.has(token)) {
        // TODO: This could be a prefix operator
        if (expect !== 'operator') throw new Error("Missing Value");

        // pop previous operators from the stack until we reach one with lower precedence
        yield * handle_op(stack, operators, operators.get(token) as OpData);
        
        // then push the new operator onto the stack
        stack.push(token);
        expect = "value";
      } else {
        if (expect !== "value") {
          yield * handle_implicit(stack, operators, this.implicitOp);
        }
        // push values directly to the output queue
        yield { type: "value", value: token } as Token;
        expect = "operator";
      }
    }

    // TODO: Previous operator could have been postfix
    if (expect !== "operator") {
      throw new Error("Missing Value");
    }

    // while there are still operator tokens on the stack, pop them to the output queue
    while(stack.length){
      const token = stack.pop();
      if(token === "("){
        throw new Error("Unbalanced Open Parentheses");
      }

      yield { type: "operator", value: operators.get(token as string) as OpData };
    }
  }

  private _interpret<T>(tokens: Iterable<string>, impl: (op: OpData) => (...args: T[]) => T, wrap: (a: string) => T) {
    const vstack: T[] = [];
    for(const token of this.parseToRPN(tokens)){
      if(token.type === "operator"){
        const opInfo = token.value;
        if(vstack.length < opInfo.arity){
          throw new Error("Missing Values");
        }
        const args = vstack.slice(vstack.length-opInfo.arity);
        vstack.length -= opInfo.arity;
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
}