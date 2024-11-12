/* eslint-disable @typescript-eslint/no-unused-vars */
import { type Observer, Subscription } from "./Subscription.js";

test("creating a subscription", () => {
  const subscription = Subscription(async (observer: Observer<string>) => {
    return { async unsubscribe() {} };
  });

  subscription;
  // ^? const subscription: Subscription<(observer: Observer<string>) => Promise<{
  //      unsubscribe(): Promise<void>;
  //    }>>
});

test("a subscription must return a promise", () => {
  // @ts-expect-error a subscription must return a promise
  Subscription((observer: Observer<string>) => {
    return { async unsubscribe() {} };
  });
});

test("a subscription must return an unsubscribe function", () => {
  // @ts-expect-error a subscription must return an unsubscribe function
  Subscription(async (observer: Observer<string>) => {});
});

test("an unsubscribe function must return a promise", () => {
  // @ts-expect-error an unsubscribe function must return a promise
  Subscription(async (observer: Observer<string>) => {
    return { unsubscribe() {} };
  });
});

test("a subscription may take 1 or more arguments", () => {
  const subscription1 = Subscription(
    async (arg1: string, observer: Observer<string>) => {
      return { async unsubscribe() {} };
    }
  );

  subscription1;
  // ^? const subscription1: Subscription<(arg1: string, observer: Observer<string>) => Promise<{
  //      unsubscribe(): Promise<void>;
  //    }>>

  const subscription2 = Subscription(
    async (arg1: string, arg2: number, observer: Observer<string>) => {
      return { async unsubscribe() {} };
    }
  );

  subscription2;
  // ^? const subscription2: Subscription<(arg1: string, arg2: number, observer: Observer<string>) => Promise<{
  //      unsubscribe(): Promise<void>;
  //    }>>
});

test("the last argument of a subscription must be an Observer", () => {
  // @ts-expect-error the last argument must ba an Observer
  Subscription(async (arg1: string) => {
    return { async unsubscribe() {} };
  });

  // @ts-expect-error the last argument must ba an Observer
  Subscription(async (arg1: Observer<string>, arg2: number) => {
    return { async unsubscribe() {} };
  });

  // TODO: Can this be fixed?
  // @ts-expect-error the last argument must ba an Observer
  Subscription(async () => {
    return { async unsubscribe() {} };
  });

  // TODO: Can this be fixed?
  // @ts-expect-error the last argument must ba an Observer
  Subscription(async (arg1) => {
    return { async unsubscribe() {} };
  });
});

test("generics are preserved", () => {
  const subscription1 = Subscription(
    async <T>(arg1: T, observer: Observer<string>) => {
      return { async unsubscribe() {} };
    }
  );

  subscription1;
  // ^? const subscription1: Subscription<(<T>(arg1: T, observer: Observer<string>) => Promise<{
  //      unsubscribe(): Promise<void>;
  //    }>)>

  const subscription2 = Subscription(
    async <T extends string | number>(
      arg1: T,
      observer: T extends string ? Observer<string> : Observer<number>
    ) => {
      return { async unsubscribe() {} };
    }
  );

  subscription2;
  // ^? const subscription2: Subscription<(<T extends string | number>(arg1: T, observer: T extends string ? Observer<string> : Observer<number>) => Promise<{
  //      unsubscribe(): Promise<void>;
  //    }>)>

  const subscription3 = Subscription(
    async <T1, T2>(arg1: T1, arg2: T2, observer: Observer<string>) => {
      return { async unsubscribe() {} };
    }
  );

  subscription3;
  // ^? const subscription3: Subscription<(<T1, T2>(arg1: T1, arg2: T2, observer: Observer<string>) => Promise<{
  //      unsubscribe(): Promise<void>;
  //    }>)>
});

test("subscribing to a subscription", async () => {
  const subscription = Subscription(async (observer: Observer<string>) => {
    return { async unsubscribe() {} };
  });

  const test = await subscription.subscribe({ next: (value) => {} });
  //                                                 ^? (parameter) value: string

  test;
  // ^? const test: {
  //      unsubscribe(): Promise<void>;
  //    }
});

test("subscribing to a generic subscription", async () => {
  const subscription = Subscription(
    async <T extends string | number>(
      arg1: T,
      observer: T extends string ? Observer<string> : Observer<number>
    ) => {
      return { async unsubscribe() {} };
    }
  );

  subscription.subscribe("👍", { next: (value) => {} });
  //                                    ^? (parameter) value: string

  subscription.subscribe(1234, { next: (value) => {} });
  //                                    ^? (parameter) value: number
});

test("subscribing to a subscription with an observer object", async () => {
  const subscription = Subscription(async (observer: Observer<string>) => {
    return { async unsubscribe() {} };
  });

  subscription.subscribe({});
  subscription.subscribe({ next: (value) => {} });
  //                              ^? (parameter) value: string
  subscription.subscribe({ complete() {} });
  subscription.subscribe({ error(error) {} });
  //                             ^? (parameter) error: unknown
});

declare function test(message: string, callback: () => void): void;
