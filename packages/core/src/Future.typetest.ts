/* eslint-disable @typescript-eslint/no-unused-vars */
import { type Flatten, Future } from "./Future.js";

test("constructing a Future", () => {
  const future = new Future<string>((resolve) => {
    resolve("hi");
  });

  future;
  // ^? const future: Future<string, never>
});

test("constructing a Future with an error", () => {
  const future = new Future<string, string>((resolve, reject) => {
    reject("hi");
  });

  future;
  // ^? const future: Future<string, string>
});

test("rejecting a value", () => {
  const future = Future.reject("💣");
  //    ^? const future: Future<never, string>
});

test("resolving a value", () => {
  const future1 = Future.resolve("👌");
  //    ^? const future1: Future<string, never>

  const future2 = Future.resolve(Promise.resolve("👌"));
  //    ^? const future2: Future<string, never>

  const future3 = Future.resolve(Future.resolve("👌"));
  //    ^? const future3: Future<string, never>

  let value!: string | Promise<string>;

  const future4 = Future.resolve(value);
  //    ^? const future4: Future<string, never>
});

test("chain a future with then", () => {
  const future = Future.resolve("👌").then((value) => value);
  //                                        ^? (parameter) value: string

  future;
  // ^? const future: Future<string, never>
});

test("chain a future with catch", () => {
  const future = Future.reject("👌").catch((value) => value);
  //                                        ^? (parameter) value: string

  future;
  // ^? const future: Future<string, string>
});

test("flattening a future", () => {
  type test = Flatten<Future<Future<Future<string, number>, boolean>, null>>;
  //   ^? type test = Future<string, number | boolean | null>

  type test2 = Flatten<Promise<Future<string, number>>>;
  //   ^? type test2 = Future<string, number>
});

test("futures are nominal typed", () => {
  type test1 = Promise<string> extends Future<string> ? "Yes" : "No";
  //   ^? type test1 = "No"

  class OtherFuture<T = void, E = never> extends Promise<T> {}
  type test2 = OtherFuture<string> extends Future<string> ? "Yes" : "No";
  //   ^? type test2 = "No"
});

declare function test(message: string, callback: () => void): void;
