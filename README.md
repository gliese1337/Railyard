Railyard
========

Railyard is a generic shunting-yard parser for parenthesized infix expressions. Want users to be able to input formulae, but don't want to rely on JavaScript's evil `eval`? Then Railyard may be for you.

Currently, Railyard only support binary infix operators. Support for prefix operators, postfix operators, and functions of arbitrary arity is planned for future versions.

Usage
-----
JavaScript: `const { Railyard } = require('railyard');`

TypeScript: `import { Railyard, AstNode, Token, OpData } from 'railyard';`

Several parser operations return an `OpData` data structure, with info about an instance of an operator in the context of an expression. This data type has the following structure:

```
type OpData = {
  name: string,
  precedence: number;
  arity: number;
  associativity: "left" | "right";
  fn?: (a: unknown, b: unknown) => unknown;
};
```

In the current version, `arity` is always `2`. This will change as support for prefix and postfix operators and functions is added.

Creating a new parser is as easy as `const parser = new Railyard();`. After that, you will need to tell your parser about the operators that you want it to recognize:

```
parser.register('^', 9, "right", Math.pow);
parser.register('*', 8, "left", (a, b) => a * b);
parser.register('/', 8, "left", (a, b) => a / b);
parser.register('%', 8, "left", (a, b) => a % b);
parser.register('+', 8, "left", (a, b) => a + b);
parser.register('-', 8, "left", (a, b) => a - b);
```

The `parser.register` method takes in a string identifying the operator, a precedence level, an associativity (left associative or right associative), and an optional JavaScript function implementing the operator. If you do not provide implementations, the parser can still *parse*, but it will not be able to evaluate the parsed expressions. 

At this point, you can call
* `parser.parseToRPN(tokens: Iterable<string>): Generator<Token>` This method returns a version of the input expression converted into de-parenthesized Reverse Polish Notation, with each original string token wrapped up in a `Token` data structure indicating whether it was originally an input value or an operator. The structure of the `Token` data type is `type Token = { type: "value"; value: string; } | { type: "operator"; value: OpData; };`
* `parser.parseToAST(tokens: Iterable<string>): AstNode` This method returns a data structure describing the fully-disambiguated parsed expression. The structure of the `AstNode` data type is `type AstNode = { type: "operator" ;value: { op: OpData; args: AstNode[]; }; } | { type: "value"; value: string; };`
* `parser.parseToSExpr(tokens: Iterable<string>): string` This method returns a version of the expression in fully-parenthesized S-expression format, similar to LISP code. This is meant primarily for debugging.

Note that all of these methods require the input to be pre-tokenized. Railyard does not know anything about your lexical grammar.

Examples:

`[...parser.parseToRPN(['3', '*', '(', '2', '+', '1', ')'])] === ['3', '2', '1', '+', '*']`

`parser.parseToSExpr('2 ^ 2 ^ 3 * b * ( a + 3 )'.split(' '))) === '(* (* (^ 2 (^ 2 3)) b) (+ a 3))'`

If you have provided implementations for all operators used in a particular expression, then you can use

* `parser.interpret(tokens: Iterable<string>): unknown` This method will attempt to apply your operator definitions to the appropriate arguments to produce a value. By default, everything token that is not recognized as a registered operator name is treated as an input value, and by default all inputs are interpreted as decimal floating-point numbers with JavaScript's built-in `parseFloat` function.

`parser.interpret(['3', '*', '(', '2', '+', '1', ')']) === 9`

However, you can also provide your own lookup function for interpreting non-operator tokens however you want, using the `parser.lookup(fn: (s: string) => unknown)` method; e.g., for looking up variable names:

```
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

Before or after registering operator definitions, you can also optionally tell Railyard to use a default operator for values in hiatus; i.e., calling `parser.setImplicitOp('*');` will cause it to interpret the input `['a', '(', 'b', '+', '1', ')']` as equivalent to `['a', '*', '(', 'b', '+', '1', ')']`. Or, `parser.interpret('a ( b + 1 )'.split(' ')) === parser.interpret('a * ( b + 1 )'.split(' '))`.