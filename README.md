Railyard
========

Railyard is a generic shunting-yard parser for parenthesized infix expressions. Want users to be able to input formulae, but don't want to rely on JavaScript's evil `eval`? Then Railyard may be for you.

Railyard supports binary infix operators, unary prefix operators, and functions of arbitrary arity.

Usage
-----
JavaScript:
```js
const {
  Railyard,
  ADD, SUB, MUL, DIV, REM,
  XOR, XNR, AND, NND, ORR, NOR,
  NEG, INV, NOT,
} = require('railyard');
```

TypeScript:
```ts
import {
  Railyard,
  ADD, SUB, MUL, DIV, REM,
  XOR, XNR, AND, NND, ORR, NOR,
  NEG, INV, NOT, Intrinsic,
  FnInfo, InfixInfo, OpInfo,
  OpNode, ValNode, ResultNode, AstNode,
  OpToken, ValToken, Token,
} from 'railyard';`
```

Several parser operations return an `OpInfo` data structure, with info about an instance of an operator in the context of an expression. This is a discriminated union of `InfixInfo` and `FnInfo` structures, which have the following format:

```ts
type InfixInfo = {
    type: 'infix';
    name: string; // String identifying the operator
    precedence: number; // How tightly this operator binds
    associativity: "left" | "right"; // In which direction it binds with equal-precedence operators 
    fn?: Intrinsic | ((a: any, b: any) => unknown);  // Optional implementation
}

type FnInfo = {
    type: 'function';
    name: string; // String identifying the operator
    arity: number; // How many arguments the function takes
    fn?: Intrinsic | ((...args: any[]) => unknown); // Optional implementation
}
```

Creating a new parser is as easy as `const parser = new Railyard();`. After that, you will need to tell your parser about the operators that you want it to recognize:

```ts
const parser = new Railyard()
    .register({ type: 'infix', name: '^', precedence: 9, associativity: "right", fn: Math.pow })
    .register({ type: 'infix', name: '*', precedence: 8, associativity: "left", fn: (a, b) => a * b })
    .register({ type: 'infix', name: '/', precedence: 8, associativity: "left", fn: (a, b) => a / b })
    .register({ type: 'infix', name: '%', precedence: 8, associativity: "left", fn: (a, b) => a % b })
    .register({ type: 'infix', name: '+', precedence: 8, associativity: "left", fn: (a, b) => a + b })
    .register({ type: 'infix', name: '-', precedence: 8, associativity: "left", fn: (a, b) => a - b })
    .register({ type: 'function', name: '-', arity: 1, fn: (a) => -a })
    .register({ type: 'function', name: 'sin', arity: 1, fn: Math.sin })
    .register({ type: 'function', name: 'xor', arity: 2, fn: (a, b) => a ^ b });
```

The `parser.register` method takes an `OpInfo` object--either `InfixInfo` or `FnInfo`. Function calls bind more tightly than any infix operators, and are right-associative. If you do not provide implementations, the parser can still *parse*, but it will not be able to evaluate the parsed expressions.

Note that, by default, functions with an arity of 1 (unary functions) are treated as unary prefix operators. I.e., `sin ( t )` parses identically to `sin t`. However, due to the maximal binding precedence of function calls, `sin 2 + 3` is equal to `sin ( 2 ) + 3`, *not* `sin ( 2 + 3 )`. Similarly, `a + - b * c` is equivalent to `a + ( - ( b ) ) * c`.

A number of `Intrinsic` symbols are provided that you can use for implementations of basic JavaScript operators, without having to provide your own function. Thus, the above registration could be done as follows instead:

```ts
const parser = new Railyard()
    .register({ type: 'infix', name: '^', precedence: 9, associativity: "right", fn: Math.pow })
    .register({ type: 'infix', name: '*', precedence: 8, associativity: "left", fn: MUL })
    .register({ type: 'infix', name: '/', precedence: 8, associativity: "left", fn: DIV })
    .register({ type: 'infix', name: '%', precedence: 8, associativity: "left", fn: REM })
    .register({ type: 'infix', name: '+', precedence: 8, associativity: "left", fn: ADD })
    .register({ type: 'infix', name: '-', precedence: 8, associativity: "left", fn: SUB })
    .register({ type: 'function', name: '-', arity: 1, fn: NEG })
    .register({ type: 'function', name: 'sin', arity: 1, fn: Math.sin })
    .register({ type: 'function', name: 'xor', arity: 2, fn: XOR });
```

The use of `Intrinsic`s makes not difference to parsing or interpretation, but does allow more effective partial evaluation and improves the performance of compiled expressions, and can be convenient to avoid re-implementing lots of simple functions anyway. The use of unwrapped, built-n `Math` functions also improves compilation efficiency, as calls to those functions can be directly inlined into compiled code.

At this point, you can call
* `parser.parseToRPN(tokens: Iterable<string>): Generator<Token>` This method returns a version of the input expression converted into de-parenthesized Reverse Polish Notation, with each original string token wrapped up in a `Token` data structure indicating whether it was originally an input value or an operator. The structure of the `Token` data type is `type Token = { type: "value"; value: string; } | { type: "operator"; value: OpInfo; };`
* `parser.parseToAST(tokens: Iterable<string>): AstNode` This method returns a data structure describing the fully-disambiguated parsed expression. The structure of the `AstNode` data type is `type AstNode = { type: "operator"; value: { op: OpInfo; args: AstNode[]; }; } | { type: "value"; value: string; };`
* `parser.parseToSExpr(tokens: Iterable<string>): string` This method returns a version of the expression in fully-parenthesized S-expression format, similar to LISP code. This is meant primarily for debugging.

Example:

`parser.parseToSExpr('2 ^ 2 ^ 3 * b * ( a + 3 )'.split(' '))) === '(* (* (^ 2 (^ 2 3)) b) (+ a 3))'`

If you have provided implementations for *all* operators used in a particular expression, then you can use

* `parser.interpret(tokens: Iterable<string>): unknown` This method will attempt to apply your operator definitions to the appropriate arguments to produce a value. By default, every token that is not recognized as a registered operator name is treated as an input value, and by default all inputs are interpreted as decimal floating-point numbers with JavaScript's built-in `parseFloat` function.

`parser.interpret(['3', '*', '(', '2', '+', '1', ')']) === 9`

However, you can also provide your own lookup function for interpreting non-operator tokens however you want, using the `parser.lookup(fn: (s: string) => unknown)` method; e.g., for looking up variable names:

```ts
const env = {
  a: 3,
  b: 5,
};

parser.lookup((v) => {
  const n = parseFloat(v);
  return isNaN(n) ? env[v] : n;
});

parser.interpret('2 ^ 2 ^ 3 b ( a + 3 )'.split(' ')) === 7680
```

If you do not have complete operator implementations, you can still use the `partial` and `compile` methods:

* `parser.partial(tokens: Iterable<string>): { ast: AstNode; free: { ops: Set<string>; vars: Set<string>; }; }` This method performs partial evaluation and returns the resulting minimized AST, along with sets of the names of unimplemented methods and missing values that would be needed to complete evaluation. The structure of the `ASTNode` data type is augmented in this case as follows: `type AstNode = { type: "operator"; value: { op: OpInfo; args: AstNode[]; }; } | { type: "result"; value: string; };`, in which a `ResultNode` indicates a final value, which should not be evaluated any further.
* `parser.compile(tokens: Iterable<string>): { fn: Function; free: { ops: Set<string>; vars: Set<string>; }; }` This method performs partial evaluation and returns a compiled JavaScript function which can complete evaluation of the expression when given the necessary missing values, along with the names of unimplemented methods and missing values that it needs. To run the returned function, pass in an object whose keys are the missing operator and value names.

The `partial` and `compile` methods depend on a `lookup` function having been set which will throw an exception for missing values. Otherwise, whatever you feel like returning will be treated as a perfectly respectable value and passed on to later stages of evaluation, without recording any missing inputs.

Compilation takes longer than direct interpretation, but if you need to evaluate an expression multiple times with different values plugged in (e.g., for graphing user-provided functions), it can be well worth it!

For a greater level of detailed control over the evaluation process, you can also use the second overload of the `interpret` method:

* `interpret<T>(tokens: Iterable<string>, val_impl: (v: string) => T, op_impl: (op: OpInfo, ...args: T[]) => T): T;`

which takes a custom value evaluation function (equivalent to what you would pass to `lookup`) and separate operator evaluation function. This is used internally to implement partial evaluation and compilation.

Note that all of these methods require the input to be pre-tokenized. Railyard does not know anything about your lexical grammar.

Railyard also has a couple of auxiliary methods to tweak the behavior of the parser. Before or after registering operator definitions, you can also optionally

* use `parser.setImplicitOp(token: string)` to tell Railyard to use a default infix operator for values in hiatus; i.e., calling `parser.setImplicitOp('*');` will cause it to interpret the input `['a', '(', 'b', '+', '1', ')']` as equivalent to `['a', '*', '(', 'b', '+', '1', ')']`; i.e., `parser.interpret('a ( b + 1 )'.split(' ')) === parser.interpret('a * ( b + 1 )'.split(' '))`. Setting a certain operator token as the implicit operator does not change its precedence! If you want, e.g., implicit multiplication and explicit multiplication to have different precedence, you must register different operators with the same implementation.
* use `parser.unaryFnAsPrefix(flag: boolean)` to tell Railyard whether to permit calling unary functions as unary prefix operators without parentheses. The default is `true`. If set to `false`, examples like `sin t` will throw an error, requiring `sin ( t )` instead.

Security Details
----------------

If you restrict your usage to parsing, or the `interpret` or `partial` methods, `Railyard` will perform no `eval`s, through any means--unless, of course, you put a call to `eval` in your own operator implementations or lookup function.

The `compile` method will invoke implied `eval` through the use of the `new Function` constructor. However, no user-supplied data is ever executed; no input strings are included in the synthesized source code. The strings identifying free variables are stored separately and used by a wrapper function to map the fields of argument objects provided to compiled functions to positional argument slots.

Appendix: Intrinsic Implementations
-----------------------------------

The complete list of available `Intrinsic` functions is as follows:

```ts
{
  [ADD]: (a, b) => a + b,
  [SUB]: (a, b) => a - b,
  [MUL]: (a, b) => a * b,
  [DIV]: (a, b) => a / b,
  [REM]: (a, b) => a % b,
  [XOR]: (a, b) => a ^ b,
  [XNR]: (a, b) => ~(a ^ b),
  [AND]: (a, b) => a & b,
  [NND]: (a, b) => ~(a & b),
  [ORR]: (a, b) => a | b,
  [NOR]: (a, b) => ~(a | b),
  [NEG]: a => -a,
  [INV]: a => ~a,
  [NOT]: a => !a,
}
```