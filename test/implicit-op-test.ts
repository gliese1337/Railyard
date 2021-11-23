import 'mocha';
import { Railyard } from '../src';
import { expect } from 'chai';

describe("Test parser with implicit op", () => {
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
    .lookup((v) => {
      const n = parseFloat(v);
      return isNaN(n) ? env[v] : n;
    }).setImplicitOp('*');
  
  it("should convert infix to RPN", () => {
    const result = [...parser.parseToRPN(['3', '(', '2', '+', '1', ')'])];
    expect(result.length).to.eql(5);
    expect(result.map((tok) => tok.type === 'operator' ? tok.value.name : tok.value)).to.eql([
      '3', '2', '1', '+', '*'
    ]);
  });

  it("should recognize unbalanced parens", () => {
    expect(() => [...parser.parseToRPN(['3', '*', '(', '2', '+', '1'])]).to.throw();
    expect(() => [...parser.parseToRPN(['(', '3', '*', '(', '2', '+', '1', ')'])]).to.throw();
  });

  it("should recognize missing values", () => {
    expect(() => [...parser.parseToRPN(['3', '*'])]).to.throw();
    expect(() => [...parser.parseToRPN(['*', '(', '2', '+', '1', ')'])]).to.throw();
  });

  it("should fill in missing operators", () => {
    expect(() => [...parser.parseToRPN(['3', '2'])]).to.not.throw();
    expect(() => [...parser.parseToRPN(['3', '(', '2', '+', '1', ')'])]).to.not.throw();
  });

  it("should convert infix to AST", () => {
    parser.parseToAST(['3', '(', '2', '+', '1', ')']);
  });

  it("should fail to convert invalid infix to AST", () => {
    expect(() => parser.parseToAST(['3', '(', '2', '+', '1'])).to.throw();
  });

  it("should correctly interpret basic arithmetic expressions", () => {
    expect(parser.interpret(['3', '(', '2', '+', '1', ')'])).to.eql(9);
    expect(parser.interpret(['3', '-', '2'])).to.eql(1);
    expect(parser.interpret(['3', '^', '2'])).to.eql(9);
    expect(parser.interpret(['2', '^', '3'])).to.eql(8);
  });

  it("should correctly interpret expressions with variables", () => {
    expect(parser.interpret(['b', '(', 'a', '+', '1', ')'])).to.eql(20);
  });

  it("should correctly interpret complex expressions", () => {
    expect(parser.interpret('2 ^ 2 ^ 3 b ( a + 3 )'.split(' '))).to.eql(7680);
    expect(parser.interpret('( 2 ^ 2 ) ^ 3 b a + 3'.split(' '))).to.eql(963);
  });

  it("should convert infix to s-expressions", () => {
    expect(parser.parseToSExpr('2 ^ 2 ^ 3 b ( a + 3 )'.split(' '))).to
      .eql('(* (* (^ 2 (^ 2 3)) b) (+ a 3))');
    expect(parser.parseToSExpr('( 2 ^ 2 ) ^ 3 b a + 3'.split(' '))).to
      .eql('(+ (* (* (^ (^ 2 2) 3) b) a) 3)');
  });
});