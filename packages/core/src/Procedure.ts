import * as JsObject from "./JsObject.js";
import * as Future from "./Future.js";

const TYPE = "Procedure";
const type = Symbol.for(TYPE);

type Procedure = (...args: never[]) => Future.Future<unknown, never>;

const Procedure = <
  const Args extends readonly unknown[],
  const R,
  const E = never
>(
  procedure: (...args: Args) => Future.Future<R, E> | Promise<R> | R
): ((...args: Args) => Future.Future<R, E>) => {
  return Object.assign(
    (...args: Args) => Future.Future.resolve(procedure(...args)),
    { [type]: TYPE }
  );
};

const isProcedure = <T>(value: T): value is T & Procedure => {
  return (
    JsObject.isObject(value) &&
    JsObject.has(value, type) &&
    value[type] === TYPE
  );
};

export { Procedure, isProcedure };
