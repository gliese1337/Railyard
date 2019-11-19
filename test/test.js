const { Railyard } = require('../dist');
const { expect } = require('chai');

describe("Test parser without implicit op", () => {
  const parser = new Railyard();
  parser.register('^', 9, "right", Math.pow);
  parser.register('*', 8, "left", (a, b) => a * b);
  parser.register('/', 8, "left", (a, b) => a / b);
  parser.register('%', 8, "left", (a, b) => a % b);
  parser.register('+', 8, "left", (a, b) => a + b);
  parser.register('-', 8, "left", (a, b) => a - b);
  
  const env = {
    a: 3,
    b: 5,
  };
  
  parser.lookup((v) => {
    const n = parseFloat(v);
    return isNaN(n) ? env[v] : n;
  });

  it("should convert infix to RPN", () => {
    const result = [...parser.parseToRPN(['3', '*', '(', '2', '+', '1', ')'])];
    expect(result.length).to.eql(5);
    expect(result.map(({ type, value }) => type === 'value' ? value : value.name)).to.eql([
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

  it("should convert infix to s-expressions", () => {
    expect(parser.parseToSExpr('2 ^ 2 ^ 3 * b * ( a + 3 )'.split(' '))).to
      .eql('(* (* (^ 2 (^ 2 3)) b) (+ a 3))');
    expect(parser.parseToSExpr('( 2 ^ 2 ) ^ 3 * b * a + 3'.split(' '))).to
      .eql('(+ (* (* (^ (^ 2 2) 3) b) a) 3)');
  });
});


describe("Test parser with implicit op", () => {
  const parser = new Railyard();
  parser.register('^', 9, "right", Math.pow);
  parser.register('*', 8, "left", (a, b) => a * b);
  parser.register('/', 8, "left", (a, b) => a / b);
  parser.register('%', 8, "left", (a, b) => a % b);
  parser.register('+', 8, "left", (a, b) => a + b);
  parser.register('-', 8, "left", (a, b) => a - b);
  
  const env = {
    a: 3,
    b: 5,
  };
  
  parser.lookup((v) => {
    const n = parseFloat(v);
    return isNaN(n) ? env[v] : n;
  });

  parser.setImplicitOp('*');
  
  it("should convert infix to RPN", () => {
    const result = [...parser.parseToRPN(['3', '(', '2', '+', '1', ')'])];
    expect(result.length).to.eql(5);
    expect(result.map(({ type, value }) => type === 'value' ? value : value.name)).to.eql([
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