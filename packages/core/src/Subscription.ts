import * as JsFunction from "./JsFunction.js";
import * as JsObject from "./JsObject.js";

type Observer<T> = {
  next?(value: T): void;
  error?(error: unknown): void;
  complete?(): void;
};

type Unsubscribe = () => Promise<void>;

const TYPE = "Subscription";
const type = Symbol.for(TYPE);

type Subscribe = (
  ...args: [...any[], Observer<any>]
) => Promise<{ unsubscribe: Unsubscribe }>;

interface Subscription<T extends Subscribe> {
  subscribe: T;
  [type]: typeof TYPE;
}

const Subscription = <
  T extends JsFunction.Async,
  Args extends readonly [...unknown[], observer: Observer<any>]
>(
  subscribe: T & ((...args: Args) => Promise<{ unsubscribe: Unsubscribe }>)
): Subscription<T> => {
  return { subscribe, [type]: TYPE };
};

const isSubscription = <T>(value: T): value is T & Subscription<Subscribe> => {
  return (
    JsObject.isObject(value) &&
    JsObject.has(value, type) &&
    value[type] === TYPE
  );
};

export { type Observer, type Unsubscribe, Subscription, isSubscription };
