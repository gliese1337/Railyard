import 'mocha';
import { Railyard } from '../src';
import { expect } from 'chai';

describe("Test parser without prefix unaries", () => {
  const env: { [key: string]: number } = {
    a: 3,
    b: 5,
  };

  const parser = new Railyard()
    .register({ type: 'infix', name: '^', precedence: 9, associativity: "right", fn: Math.pow })
    .register({ type: 'infix', name: '*', precedence: 8, associativity: "left", fn: (a, b) => a * b })
    .register({ type: 'infix', name: '/', precedence: 8, associativity: "left", fn: (a, b) => a / b })
    .register({ type: 'infix', name: '%', precedence: 8, associativity: "left", fn: (a, b) => a % b })
    .register({ type: 'infix', name: '+', precedence: 8, associativity: "left", fn: (a, b) => a + b })
    .register({ type: 'infix', name: '-', precedence: 8, associativity: "left", fn: (a, b) => a - b })
    .register({ type: 'function', name: 'sin', arity: 1, fn: Math.sin })
    .register({ type: 'function', name: 'mul', arity: 2, fn: (a, b) => a * b })
    .unaryFnAsPrefix(false)
    .lookup((v) => {
      const n = parseFloat(v);
      return isNaN(n) ? env[v] : n;
    });

  it("should throw on incorrect function call syntax", () => {
    expect(() => parser.parseToSExpr('sin 2 + mul ( 4 , 5 )'.split(' '))).to.throw();
    expect(() => parser.parseToSExpr('mul ( 3 , sin 5 )'.split(' '))).to.throw();
  });
});
