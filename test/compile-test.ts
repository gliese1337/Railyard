import 'mocha';
import { ADD, DIV, MUL, Railyard, SUB } from '../src';
import { expect } from 'chai';

describe("Test compiler", () => {
  const intrinsicParser = new Railyard()
    .register({ type: 'infix', name: '^', precedence: 9, associativity: "right" })
    .register({ type: 'infix', name: '*', precedence: 8, associativity: "left", fn: MUL })
    .register({ type: 'infix', name: '/', precedence: 8, associativity: "left", fn: DIV })
    .register({ type: 'infix', name: '+', precedence: 8, associativity: "left", fn: ADD })
    .register({ type: 'infix', name: '-', precedence: 8, associativity: "left", fn: SUB })
    .register({ type: 'function', name: 'sin', arity: 1, fn: Math.sin })
    .lookup((v) => {
      if (v === 'pi') return Math.PI;
      const n = parseFloat(v);
      if (isNaN(n)) throw 0;
      return n;
    }).setImplicitOp('*');
  
  const inlineParser = new Railyard()
    .register({ type: 'infix', name: '^', precedence: 9, associativity: "right" })
    .register({ type: 'infix', name: '*', precedence: 8, associativity: "left", js_inline: (a, b) => `(${a})*(${b})` })
    .register({ type: 'infix', name: '/', precedence: 8, associativity: "left", js_inline: (a, b) => `(${a})/(${b})` })
    .register({ type: 'infix', name: '+', precedence: 8, associativity: "left", js_inline: (a, b) => `(${a})+(${b})` })
    .register({ type: 'infix', name: '-', precedence: 8, associativity: "left", js_inline: (a, b) => `(${a})-(${b})` })
    .register({ type: 'function', name: 'sin', arity: 1, fn: Math.sin })
    .lookup((v) => {
      if (v === 'pi') return Math.PI;
      const n = parseFloat(v);
      if (isNaN(n)) throw 0;
      return n;
    }).setImplicitOp('*');

  function parserTests(parser: Railyard, type: string) {
    it(`should correctly compile basic arithmetic expressions with ${type} implementations`, () => {
      let { fn, free: { ops, vars } } = parser.compile(['3', '(', '2', '+', '1', ')']);
      expect(ops.size).to.eql(0);
      expect(vars.size).to.eql(0);
      expect(fn()).to.eql(9);

      ({ fn, free: { ops, vars } } = parser.compile(['3', '-', '2']));
      expect(ops.size).to.eql(0);
      expect(vars.size).to.eql(0);
      expect(fn()).to.eql(1);
      
      ({ fn, free: { ops, vars } } = parser.compile(['3', '^', '2']));
      expect(ops.size).to.eql(1);
      expect(vars.size).to.eql(0);
      expect(fn({ "^": Math.pow })).to.eql(9);
      
      ({ fn, free: { ops, vars } } = parser.compile(['2', '^', '3']));
      expect(ops.size).to.eql(1);
      expect(vars.size).to.eql(0);
      expect(fn({ "^": Math.pow })).to.eql(8);

      ({ fn, free: { ops, vars } } = parser.compile(['2', '*', '3', '/', '3']));
      expect(ops.size).to.eql(0);
      expect(vars.size).to.eql(0);
      expect(fn()).to.eql(2);
    });

    it(`should correctly compile expressions with variables with ${type} implementations`, () => {
      let { fn, free: { ops, vars } } = parser.compile(['b', '(', 'a', '+', '1', ')']);
      expect(ops.size).to.eql(0);
      expect(vars.size).to.eql(2);
      expect(fn({
        a: 3,
        b: 5,
      })).to.eql(20);

      ({ fn, free: { ops, vars } } = parser.compile(['2', '*', 't', '/', 'pi']));
      expect(ops.size).to.eql(0);
      expect(vars.size).to.eql(1);
      expect(fn({ t: Math.PI })).to.eql(2);
    });

    it(`should correctly compile expressions with Math functions with ${type} implementations`, () => {
      let { fn, free: { ops, vars } } = parser.compile(['sin', 'pi']);
      expect(ops.size).to.eql(0);
      expect(vars.size).to.eql(0);
      expect(fn()).to.be.lessThan(0.000001);

      ({ fn, free: { ops, vars } } = parser.compile(['sin', '(', 'a', '*', 'b', ')']));
      expect(ops.size).to.eql(0);
      expect(vars.size).to.eql(2);
      expect(fn({ a: 1, b: Math.PI })).to.be.lessThan(0.000001);
    });

    it(`should correctly compile complex expressions with ${type} implementations`, () => {
      let { fn, free: { ops, vars } } = parser.compile('2 ^ 2 ^ 3 b ( a + 3 )'.split(' '));
      expect(ops.size).to.eql(1);
      expect(vars.size).to.eql(2);
      expect(fn({
        a: 3,
        b: 5,
        '^': Math.pow,
      })).to.eql(7680);
      
      ({ fn, free: { ops, vars } } = parser.compile('( 2 ^ 2 ) ^ 3 b a + 3'.split(' ')));
      expect(ops.size).to.eql(1);
      expect(vars.size).to.eql(2);
      expect(fn({
        a: 3,
        b: 5,
        '^': Math.pow,
      })).to.eql(963);
    });
  }

  parserTests(intrinsicParser, 'intrinsic');
  parserTests(inlineParser, 'inline');
});