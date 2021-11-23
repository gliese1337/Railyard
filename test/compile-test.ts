import 'mocha';
import { Railyard } from '../src';
import { expect } from 'chai';

describe("Test compiler", () => {
  const parser = new Railyard()
    .register({ type: 'infix', name: '^', precedence: 9, associativity: "right", fn: Math.pow })
    .register({ type: 'infix', name: '*', precedence: 8, associativity: "left" })
    .register({ type: 'infix', name: '/', precedence: 8, associativity: "left", fn: (a, b) => a / b })
    .register({ type: 'infix', name: '%', precedence: 8, associativity: "left", fn: (a, b) => a % b })
    .register({ type: 'infix', name: '+', precedence: 8, associativity: "left", fn: (a, b) => a + b })
    .register({ type: 'infix', name: '-', precedence: 8, associativity: "left", fn: (a, b) => a - b })
    .lookup((v) => {
      const n = parseFloat(v);
      if (isNaN(n)) throw 0;
      return n;
    }).setImplicitOp('*');

  it("should correctly compile basic arithmetic expressions", () => {
    let { fn, free: { ops, vars } } = parser.compile(['3', '(', '2', '+', '1', ')']);
    expect(ops.size).to.eql(1);
    expect(vars.size).to.eql(0);
    expect(fn({ '*': (a: number, b: number) => a * b })).to.eql(9);

    ({ fn, free: { ops, vars } } = parser.compile(['3', '-', '2']));
    expect(ops.size).to.eql(0);
    expect(vars.size).to.eql(0);
    expect(fn()).to.eql(1);
    
    ({ fn, free: { ops, vars } } = parser.compile(['3', '^', '2']));
    expect(ops.size).to.eql(0);
    expect(vars.size).to.eql(0);
    expect(fn()).to.eql(9);
    
    ({ fn, free: { ops, vars } } = parser.compile(['2', '^', '3']));
    expect(ops.size).to.eql(0);
    expect(vars.size).to.eql(0);
    expect(fn()).to.eql(8);
  });

  it("should correctly compile expressions with variables", () => {
    let { fn, free: { ops, vars } } = parser.compile(['b', '(', 'a', '+', '1', ')']);
    expect(ops.size).to.eql(1);
    expect(vars.size).to.eql(2);
    expect(fn({
      a: 3,
      b: 5,
      '*': (a: number, b: number) => a * b,
    })).to.eql(20);
  });

  it("should correctly compile complex expressions", () => {
    let { fn, free: { ops, vars } } = parser.compile('2 ^ 2 ^ 3 b ( a + 3 )'.split(' '));
    expect(ops.size).to.eql(1);
    expect(vars.size).to.eql(2);
    expect(fn({
      a: 3,
      b: 5,
      '*': (a: number, b: number) => a * b,
    })).to.eql(7680);
    
    ({ fn, free: { ops, vars } } = parser.compile('( 2 ^ 2 ) ^ 3 b a + 3'.split(' ')));
    expect(ops.size).to.eql(1);
    expect(vars.size).to.eql(2);
    expect(fn({
      a: 3,
      b: 5,
      '*': (a: number, b: number) => a * b,
    })).to.eql(963);
  });
});