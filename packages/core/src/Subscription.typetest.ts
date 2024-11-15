/* eslint-disable @typescript-eslint/no-unused-vars */
import { Observable, of } from "./Observable/index.js";
import { type Observer, Subscription } from "./Subscription.js";
import { Fail } from "./Try.js";

test("creating a subscription", () => {
  const subscription = Subscription(() => of(1));
  //    ^? const subscription: (observer: Observer<number>) => Future<Subscription, never>
});

test("a subscription must return an observable", () => {
  // @ts-expect-error Type 'string' is not assignable to type 'Observable<unknown>'.
  const subscription = Subscription(() => "🥸");
});

test("a subscription may take 1 or more arguments", () => {
  const subscription1 = Subscription(async (foo: string) => {
    return of("👍");
  });

  subscription1;
  // ^? const subscription1: (foo: string, observer: Observer<string>) => Future<Subscription, never>

  const subscription2 = Subscription(async (arg1: string, arg2: number) => {
    return of(true);
  });

  subscription2;
  // ^? const subscription2: (arg1: string, arg2: number, observer: Observer<boolean>) => Future<Subscription, never>
});

test("generics are preserved", () => {
  const subscription1 = Subscription(async <T>(arg1: T) => of(1));

  subscription1;
  // ^? const subscription1: <T>(arg1: T, observer: Observer<number>) => Future<Subscription, never>

  const subscription2 = Subscription(
    async <T extends string | number>(arg1: T) =>
      (typeof arg1 === "string" ? of("hi") : of(1)) as T extends string
        ? Observable<string>
        : Observable<number>
  );

  subscription2;
  // ^? const subscription2: <T extends string | number>(arg1: T, observer: Observer<ObservableType<SuccessType<T extends string ? Observable<string> : Observable<number>>>>) => Future<...>

  const subscription3 = Subscription(async <T1, T2>(arg1: T1, arg2: T2) =>
    of(1)
  );

  subscription3;
  // ^? const subscription3: <T1, T2>(arg1: T1, arg2: T2, observer: Observer<number>) => Future<Subscription, never>
});

test("subscribing to a subscription", async () => {
  const subscription = Subscription(async () => {
    return of(99);
  });

  const test = await subscription({ next: (value) => {} });
  //                                       ^? (parameter) value: number

  test;
  // ^? const test: Subscription
});

test("subscribing to a generic subscription", async () => {
  const subscription = Subscription(
    async <T extends string | number>(arg1: T) => {
      return (typeof arg1 === "string" ? of("hi") : of(1)) as T extends string
        ? Observable<string>
        : Observable<number>;
    }
  );

  subscription;
  // ^? const subscription: <T extends string | number>(arg1: T, observer: Observer<ObservableType<SuccessType<T extends string ? Observable<string> : Observable<number>>>>) => Future<...>

  const sub1 = subscription("hi", (value) => console.log(value));
  //                               ^? (parameter) value: string

  const sub2 = subscription(99, (value) => console.log(value));
  //                             ^? (parameter) value: number
});

test("subscribing to a subscription with an observer object", async () => {
  const subscription = Subscription(async () => {
    return of("🤘");
  });

  subscription({});
  subscription({ next: (value) => {} });
  //                    ^? (parameter) value: string
  subscription({ complete() {} });
  subscription({ error(error) {} });
  //                   ^? (parameter) error: unknown
});

test("a subscription that fails", () => {
  const subscription = Subscription(() => {
    if (Math.random() > 0.5) return Fail("💩");
    return of(12);
  });

  subscription;
  // ^? const subscription: (observer: Observer<number>) => Future<Subscription, "💩">
});

declare function test(message: string, callback: () => void): void;
