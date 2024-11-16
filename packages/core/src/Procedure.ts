import * as JsFunction from "./JsFunction.js";
import * as JsObject from "./JsObject.js";
import * as Try from "./Try.js";
import * as Future from "./Future.js";
import * as Injector from "./Injector.js";

const TYPE = "Procedure";
const type = Symbol.for(TYPE);

type Procedure = JsFunction.Bivariant<
  (...args: unknown[]) => Future.Future<unknown, never>
>;

type FailureType<Return> = Return extends Future.Future<unknown, infer E>
  ? E
  : Return extends Promise<infer V>
    ? FailureType<V>
    : Return extends Try.Fail<infer E>
      ? E
      : never;

type SuccessType<Return> = Return extends Future.Future<infer V>
  ? V
  : Return extends Promise<infer V>
    ? SuccessType<V>
    : Return extends Try.Succeed<infer V>
      ? V
      : Return extends Try.Fail<unknown>
        ? never
        : Return;

const Procedure = <const Args extends readonly unknown[], const Return>(
  procedure: (...args: Args) => Return
): ((
  ...args: [...Args]
) => Future.Future<SuccessType<Return>, FailureType<Return>>) => {
  return Object.assign(
    Injector.provide(Injector.getTags(procedure), (...args: [...Args]) =>
      new Future.Future<Return>((resolve) => resolve(procedure(...args))).then(
        (value) => {
          switch (true) {
            case Try.isFail(value):
              return Future.Future.reject(value.reason as FailureType<Return>);
            case Try.isSucceed(value):
              return value.value as SuccessType<Return>;
            default:
              return value as SuccessType<Return>;
          }
        }
      )
    ),
    { [type]: TYPE }
  );
};

const isProcedure = <const T>(value: T): value is T & Procedure => {
  return (
    JsObject.isObject(value) &&
    JsObject.has(value, type) &&
    value[type] === TYPE
  );
};

export { type FailureType, type SuccessType, Procedure, isProcedure };
