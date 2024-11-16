import * as Future from "./Future.js";
import * as Injector from "./Injector.js";
import * as JsFunction from "./JsFunction.js";
import * as JsObject from "./JsObject.js";
import * as Observable from "./Observable/index.js";
import * as Procedure from "./Procedure.js";
import * as Try from "./Try.js";

const TYPE = "Subscription";
const type = Symbol.for(TYPE);

type Observer<T> = ((next: T) => void) | Observable.Observer<T>;

type ObservableType<T> = T extends Observable.Observable<infer V> ? V : never;

type Subscription = JsFunction.Bivariant<
  (
    ...args: [...unknown[], observer: Observer<never>]
  ) => Future.Future<Observable.Subscription, never>
>;

const Subscription = <
  const Args extends readonly unknown[],
  const Return extends
    | Future.Future<Observable.Observable<unknown>, unknown>
    | Promise<Try.Try<Observable.Observable<unknown>, unknown>>
    | Promise<Observable.Observable<unknown>>
    | Try.Try<Observable.Observable<unknown>, unknown>
    | Observable.Observable<unknown>
>(
  subscription: (...args: Args) => Return
): ((
  ...args: [
    ...Args,
    observer: Observer<ObservableType<Procedure.SuccessType<Return>>>
  ]
) => Future.Future<Observable.Subscription, Procedure.FailureType<Return>>) => {
  return Object.assign(
    Injector.provide(
      Injector.getTags(subscription),
      (
        ...args: [
          ...Args,
          observer: Observer<ObservableType<Procedure.SuccessType<Return>>>
        ]
      ) => {
        const params = args.slice(0, -1) as unknown as Args;
        const observer = args.at(-1) as Observer<
          ObservableType<Procedure.SuccessType<Return>>
        >;

        return Procedure.Procedure(subscription)(...params).then(
          (observable) => {
            return (observable as Observable.Observable<unknown>).subscribe(
              observer as Observer<unknown>
            );
          }
        );
      }
    ),
    { [type]: TYPE }
  );
};

const isSubscription = <T>(value: T): value is T & Subscription => {
  return (
    JsObject.isObject(value) &&
    JsObject.has(value, type) &&
    value[type] === TYPE
  );
};

export { type Observer, Subscription, isSubscription };
