import * as Subject from "./Subject.js";

interface Subscription<T> extends Subject.Subject<T> {
  _tag: "Subscription";
}

function Subscription<T>(): Subscription<T> {
  return {} as Subscription<T>;
}

export { Subscription };
