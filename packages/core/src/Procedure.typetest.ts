/* eslint-disable @typescript-eslint/no-unused-vars */
import { Procedure, isProcedure } from "./Procedure.js";
import { Future } from "./Future.js";

test("creating a procedure", () => {
  const procedure1 = Procedure(() => {});
  //    ^? const procedure1: () => Future<void, never>

  const procedure2 = Procedure(() => "hi");
  //    ^? const procedure2: () => Future<string, never>
});

test("creating a procedure that returns a promise", () => {
  // The error type is any in this case because a promise does not encode an
  // error type
  const procedure = Procedure(async () => "hi");
  //    ^? const procedure: () => Future<string, any>
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
  // ^? const procedure: <T>(arg: T) => Future<T extends string ? number : boolean, never>

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
  // ^? const procedure: <T>(arg: T) => Future<T extends string ? number : boolean, any>

  const call1 = procedure("hi");
  //    ^? const call1: Future<number, any>

  const call2 = procedure(13);
  //    ^? const call2: Future<boolean, any>
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

declare function test(message: string, callback: () => void): void;
