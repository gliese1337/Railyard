import 'mocha';
import { ADD, Railyard } from '../src';
import { expect } from 'chai';

describe("Test partial evaluator", () => {
  const parser = new Railyard()
    .register({ type: 'infix', name: '^', precedence: 9, associativity: "right", fn: Math.pow })
    .register({ type: 'infix', name: '*', precedence: 8, associativity: "left" })
    .register({ type: 'infix', name: '/', precedence: 8, associativity: "left", fn: (a, b) => a / b })
    .register({ type: 'infix', name: '+', precedence: 8, associativity: "left", fn: ADD })
    .register({ type: 'infix', name: '-', precedence: 8, associativity: "left", fn: (a, b) => a - b })
    .lookup((v) => {
      const n = parseFloat(v);
      if (isNaN(n)) throw 0;
      return n;
    }).setImplicitOp('*');

  it("should correctly evaluate basic arithmetic expressions", () => {
    let { ast, free: { ops, vars } } = parser.partial(['3', '(', '2', '+', '1', ')']);
    expect(ops.size).to.eql(1);
    expect(vars.size).to.eql(0);
    expect(ast).to.eql({
      "type":"operator",
      "value":{
        "op":{
          "type":"infix",
          "name":"*",
          "precedence":8,
          "associativity":"left"
        },
        "args":[
          {"type":"result","value":3},
          {"type":"result","value":3}
        ]
      }
    });

    ({ ast, free: { ops, vars } } = parser.partial(['3', '-', '2']));
    expect(ops.size).to.eql(0);
    expect(vars.size).to.eql(0);
    expect(ast).to.eql({"type":"result","value":1});

    ({ ast, free: { ops, vars } } = parser.partial(['3', '^', '2']));
    expect(ops.size).to.eql(0);
    expect(vars.size).to.eql(0);
    expect(ast).to.eql({"type":"result","value":9});

    ({ ast, free: { ops, vars } } = parser.partial(['2', '^', '3']));
    expect(ops.size).to.eql(0);
    expect(vars.size).to.eql(0);
    expect(ast).to.eql({"type":"result","value":8});
  });

  it("should correctly evaluate expressions with variables", () => {
    let { ast, free: { ops, vars } } = parser.partial(['b', '(', 'a', '+', '1', ')']);
    expect(ops.size).to.eql(1);
    expect(vars.size).to.eql(2);
    expect(JSON.stringify(ast)).to.eql(
      '{"type":"operator","value":{"op":{"type":"infix","name":"*","precedence":8,"associativity":"left"},"args":[{"type":"value","value":"b"},{"type":"operator","value":{"op":{"type":"infix","name":"+","precedence":8,"associativity":"left"},"args":[{"type":"value","value":"a"},{"type":"result","value":1}]}}]}}'
    );
  });

  it("should correctly evaluate complex expressions", () => {
    let { ast, free: { ops, vars } } = parser.partial('2 ^ 2 ^ 3 b ( a + 3 )'.split(' '));
    expect(ops.size).to.eql(1);
    expect(vars.size).to.eql(2);
    expect(JSON.stringify(ast)).to.eql(
      '{"type":"operator","value":{"op":{"type":"infix","name":"*","precedence":8,"associativity":"left"},"args":[{"type":"operator","value":{"op":{"type":"infix","name":"*","precedence":8,"associativity":"left"},"args":[{"type":"result","value":256},{"type":"value","value":"b"}]}},{"type":"operator","value":{"op":{"type":"infix","name":"+","precedence":8,"associativity":"left"},"args":[{"type":"value","value":"a"},{"type":"result","value":3}]}}]}}'
    );
    
    ({ ast, free: { ops, vars } } = parser.partial('( 2 ^ 2 ) ^ 3 b a + 3'.split(' ')));
    expect(ops.size).to.eql(1);
    expect(vars.size).to.eql(2);
    expect(JSON.stringify(ast)).to.eql(
      '{"type":"operator","value":{"op":{"type":"infix","name":"+","precedence":8,"associativity":"left"},"args":[{"type":"operator","value":{"op":{"type":"infix","name":"*","precedence":8,"associativity":"left"},"args":[{"type":"operator","value":{"op":{"type":"infix","name":"*","precedence":8,"associativity":"left"},"args":[{"type":"result","value":64},{"type":"value","value":"b"}]}},{"type":"value","value":"a"}]}},{"type":"result","value":3}]}}'
    );
  });
});