import * as Subject from "./Subject.js";

interface Subscription<T> {
  next(value: T): void;
  subscribe(observer: (value: T) => void): { unsubscribe(): void };
  _tag: "Subscription";
}

function Subscription<T>(): Subscription<T> {
  return Subject.init() as unknown as Subscription<T>;
}

export { Subscription };
