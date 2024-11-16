/* eslint-disable @typescript-eslint/no-unused-vars */
import { Procedure, isProcedure } from "./Procedure.js";
import { Future } from "./Future.js";
import { Fail, Succeed } from "./Try.js";

test("creating a procedure", () => {
  const procedure1 = Procedure(() => {});
  //    ^? const procedure1: () => Future<void, never>

  const procedure2 = Procedure(() => "hi");
  //    ^? const procedure2: () => Future<string, never>

  const procedure3 = Procedure(() => Succeed("hi"));
  //    ^? const procedure3: () => Future<"hi", never>
});

test("creating a procedure that returns a promise", () => {
  // The error type is any in this case because a promise does not encode an
  // error type
  const procedure = Procedure(async () => "hi");
  //    ^? const procedure: () => Future<string, never>
});

test("creating a procedure that returns a Try wrapped in a promise", () => {
  const procedure = Procedure(async () => {
    if (Math.random() > 0.5) return Fail("💣");
    return "hi";
  });

  procedure;
  // ^? const procedure: () => Future<"hi", "💣">
});

test("creating a procedure that returns a future", () => {
  const procedure = Procedure(() => Future.resolve("hi"));
  //    ^? const procedure: () => Future<string, never>
});

test("creating a procedure that returns a future that rejects", () => {
  const procedure = Procedure(() => Future.reject("💣"));
  //    ^? const procedure: () => Future<never, string>
});

test("creating a generic procedure", () => {
  const procedure = Procedure(<T>(arg: T) => {
    return (typeof arg === "string" ? 12 : true) as T extends string
      ? number
      : boolean;
  });

  procedure;
  // ^? const procedure: <T>(arg: T) => Future<SuccessType<T extends string ? number : boolean>, FailureType<T extends string ? number : boolean>>

  const call1 = procedure("hi");
  //    ^? const call1: Future<number, never>

  const call2 = procedure(13);
  //    ^? const call2: Future<boolean, never>
});

test("creating a generic procedure that returns a promise", () => {
  const procedure = Procedure(async <T>(arg: T) => {
    return (typeof arg === "string" ? 12 : true) as T extends string
      ? number
      : boolean;
  });

  procedure;
  // ^? const procedure: <T>(arg: T) => Future<SuccessType<T extends string ? number : boolean>, FailureType<T extends string ? number : boolean>>

  const call1 = procedure("hi");
  //    ^? const call1: Future<number, never>

  const call2 = procedure(13);
  //    ^? const call2: Future<boolean, never>
});

test("creating a generic procedure that returns a future", () => {
  const procedure = Procedure(<T>(arg: T) => {
    return Future.resolve(
      (typeof arg === "string" ? 12 : true) as T extends string
        ? number
        : boolean
    );
  });

  procedure;
  // ^? const procedure: <T>(arg: T) => Future<T extends string ? number : boolean, never>

  const call1 = procedure("hi");
  //    ^? const call1: Future<number, never>

  const call2 = procedure(13);
  //    ^? const call2: Future<boolean, never>
});

test("procedures are nominal typed sorta", () => {
  // @ts-expect-error type "hi" is not assignable to type Future
  const foo: Procedure = () => "hi";

  class OtherFuture<T = void, E = never> extends Promise<T> {}

  const foo1: Procedure = () =>
    // @ts-expect-error OtherFuture<string> is not assignable to type Future
    OtherFuture.resolve("hi") as OtherFuture<string>;

  // OK
  const foo2: Procedure = () => Future.resolve("hi");
});

test("isProcedure performs lossless type narrowing", () => {
  let fun: unknown;

  if (isProcedure(fun)) {
    fun;
    // ^? let fun: Procedure
  }

  const fun2 = Procedure(() => "hi");

  if (isProcedure(fun2)) {
    fun2;
    // ^? const fun2: () => Future<string, never>
  }
});

test("the Procedure type", () => {
  const sub1 = Procedure(() => 1);
  const sub2 = Procedure((foo: number) => 1);
  const sub3 = (foo: number) => Promise.resolve(1);

  type Test1 = typeof sub1 extends Procedure ? "Yes" : "No";
  //   ^? type Test1 = "Yes"

  type Test2 = typeof sub2 extends Procedure ? "Yes" : "No";
  //   ^? type Test2 = "Yes"

  type Test3 = typeof sub3 extends Procedure ? "Yes" : "No";
  //   ^? type Test3 = "No"

  const valid0: Procedure = (arg1: string) => Future.resolve(1);
  const valid1: Procedure = () => Future.resolve(1);
});

declare function test(message: string, callback: () => void): void;
