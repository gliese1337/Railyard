import { OpInfo, Token } from "./types";

export function interpret<T>(tokens: Iterable<Token>, impl: (op: OpInfo, ...args: T[]) => T, wrap: (a: string) => T) {
  const vstack: T[] = [];
  for(const token of tokens){
    if(token.type === "operator"){
      const opInfo = token.value;
      const arity = opInfo.type === 'infix' ? 2 : opInfo.arity;
      if(vstack.length < arity){
        throw new Error("Missing Values");
      }
      const args = vstack.slice(vstack.length-arity);
      vstack.length -= arity;
      vstack.push(impl(opInfo, ...args));
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