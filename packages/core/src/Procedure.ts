import * as JsFunction from "./JsFunction.js";
import * as JsObject from "./JsObject.js";

const TYPE = "Procedure";
const type = Symbol.for(TYPE);

type Procedure<T extends JsFunction.Async> = {
  call: T;
  [type]: typeof TYPE;
};

const Procedure = <T extends JsFunction.Async>(func: T): Procedure<T> => {
  return { call: func, [type]: TYPE };
};

const isProcedure = <T>(value: T): value is T & Procedure<JsFunction.Async> => {
  return (
    JsObject.isObject(value) &&
    JsObject.has(value, type) &&
    value[type] === TYPE
  );
};

export { Procedure, isProcedure };
