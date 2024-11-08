import * as JsFunction from "./JsFunction.js";

type CallSignature<T> = T extends Procedure<infer F> ? F : never;

type Procedure<T extends JsFunction.Async> = {
  call: T;
  _tag: "Procedure";
};

const Procedure = <T extends JsFunction.Async>(func: T): Procedure<T> => {
  return { call: func, _tag: "Procedure" };
};

export { type CallSignature, Procedure };
