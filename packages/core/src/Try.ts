import * as JsObject from "./JsObject.js";

type Fail<E> = {
  reason: E;
  type: "Fail";
};

const Fail = <const E>(reason: E): Fail<E> => ({
  reason,
  type: "Fail"
});

type Succeed<V> = {
  value: V;
  type: "Succeed";
};

const Succeed = <const V>(value: V): Succeed<V> => ({
  value,
  type: "Succeed"
});

type Try<V, E> = Succeed<V> | Fail<E>;

const isFail = <T>(value: T): value is T & Fail<unknown> => {
  return (
    JsObject.isObject(value) &&
    JsObject.has(value, "type") &&
    value.type === "Fail"
  );
};

const isSucceed = <T>(value: T): value is T & Succeed<unknown> => {
  return (
    JsObject.isObject(value) &&
    JsObject.has(value, "type") &&
    value.type === "Succeed"
  );
};

export { type Try, Fail, Succeed, isFail, isSucceed };
