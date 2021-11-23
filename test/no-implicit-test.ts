import 'mocha';
import { Railyard } from '../src';
import { expect } from 'chai';

describe("Test parser without implicit op", () => {
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
    .register({ type: 'function', name: '-', arity: 1, fn: (a) => -a })
    .register({ type: 'function', name: 'sin', arity: 1, fn: Math.sin })
    .register({ type: 'function', name: 'mul', arity: 2, fn: (a, b) => a * b })
    .lookup((v) => {
      const n = parseFloat(v);
      return isNaN(n) ? env[v] : n;
    });

  it("should convert infix to RPN", () => {
    const result = [...parser.parseToRPN(['3', '*', '(', '2', '+', '1', ')'])];
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

  it("should recognize missing operators", () => {
    expect(() => [...parser.parseToRPN(['3', '2'])]).to.throw();
    expect(() => [...parser.parseToRPN(['3', '(', '2', '+', '1', ')'])]).to.throw();
  });

  it("should convert infix to AST", () => {
    parser.parseToAST(['3', '*', '(', '2', '+', '1', ')']);
  });

  it("should fail to convert invalid infix to AST", () => {
    expect(() => parser.parseToAST(['3', '*', '(', '2', '+', '1'])).to.throw();
  });

  it("should correctly interpret basic arithmetic expressions", () => {
    expect(parser.interpret(['3', '*', '(', '2', '+', '1', ')'])).to.eql(9);
    expect(parser.interpret(['3', '-', '2'])).to.eql(1);
    expect(parser.interpret(['3', '^', '2'])).to.eql(9);
    expect(parser.interpret(['2', '^', '3'])).to.eql(8);
  });

  it("should correctly interpret expressions with variables", () => {
    expect(parser.interpret(['b', '*', '(', 'a', '+', '1', ')'])).to.eql(20);
  });

  it("should correctly interpret complex expressions", () => {
    expect(parser.interpret('2 ^ 2 ^ 3 * b * ( a + 3 )'.split(' '))).to.eql(7680);
    expect(parser.interpret('( 2 ^ 2 ) ^ 3 * b * a + 3'.split(' '))).to.eql(963);
  });
  
  it("should correctly interpret unary minus", () => {
    expect(parser.interpret(['b', '*', '-', 'a'])).to.eql(-15);
  });

  it("should convert infix to s-expressions", () => {
    expect(parser.parseToSExpr('2 ^ 2 ^ 3 * b * ( a + 3 )'.split(' '))).to
      .eql('(* (* (^ 2 (^ 2 3)) b) (+ a 3))');
    expect(parser.parseToSExpr('( 2 ^ 2 ) ^ 3 * b * a + 3'.split(' '))).to
      .eql('(+ (* (* (^ (^ 2 2) 3) b) a) 3)');
  });
    
  it("should parse simple function calls", () => {
    expect(parser.parseToSExpr('sin ( 2 ) + mul ( 4 , 5 )'.split(' '))).to
      .eql('(+ (sin 2) (mul 4 5))');
    expect(parser.parseToSExpr('sin 2 + mul ( 4 , 5 )'.split(' '))).to
      .eql('(+ (sin 2) (mul 4 5))');
    expect(() => parser.parseToSExpr('sin 2 + mul 4 , 5'.split(' '))).to.throw();
    expect(() => parser.parseToSExpr('sin 2 + mul 4 5'.split(' '))).to.throw();
    expect(() => parser.parseToSExpr('sin ( 2 ) + mul 4 , 5'.split(' '))).to.throw();
    expect(() => parser.parseToSExpr('sin ( 2 ) + mul 4 5'.split(' '))).to.throw();
    expect(parser.parseToSExpr('mul ( 3 , sin 5 )'.split(' '))).to
      .eql('(mul 3 (sin 5))');
    expect(parser.parseToSExpr('sin sin 2'.split(' '))).to
      .eql('(sin (sin 2))');
  });

  it("should parse comples function calls", () => {
    expect(parser.parseToSExpr('sin ( 2 ) + mul ( - 4 + sin 7 , 5 )'.split(' '))).to
      .eql('(+ (sin 2) (mul (+ (- 4) (sin 7)) 5))');
    expect(parser.parseToSExpr('sin ( 4 + 4 ) + mul ( 4 , sin 2 * 5 )'.split(' '))).to
      .eql('(+ (sin (+ 4 4)) (mul 4 (* (sin 2) 5)))');
  });

  it("should get function call precedence right", () => {
    expect(parser.parseToSExpr('sin 2 + 3'.split(' '))).to
      .eql(parser.parseToSExpr('sin ( 2 ) + 3'.split(' ')));
  });
});