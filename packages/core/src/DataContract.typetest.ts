/* eslint-disable @typescript-eslint/no-unused-vars */
import { DataContract } from "./DataContract.js";
import { Future } from "./Future.js";
import { Json } from "./Json.js";
import { Succeed, Fail } from "./Try.js";

test("creating a data contract", () => {
  const dataContract = DataContract();
  //    ^? const dataContract: DataContract<unknown, unknown>
});

test("creating a data contract with an explicit IO type", () => {
  const dataContract = DataContract<Json>();
  //    ^? const dataContract: DataContract<Json, Json>
});

test("creating a data contract with an explicit transfer format", () => {
  const dataContract = DataContract<Json, string>();
  //    ^? const dataContract: DataContract<Json, string>
});

test("restricting the IO parameters of a procedure", () => {
  const { Procedure } = DataContract<Json>();

  // @ts-expect-error Type 'Error' is not assignable to type 'Json'.
  Procedure(() => new Error());

  // @ts-expect-error Type 'void' is not assignable to type 'Json'.
  Procedure(() => {});

  // @ts-expect-error Type 'Json' is not assignable to type 'Map<string, number>'.
  Procedure((map: Map<string, number>) => "hi");

  const p1 = Procedure((map: { [key: string]: number }) => "hi");
  //    ^? const p1: (map: { [key: string]: number; }) => Future<"hi", never>

  const p2 = Procedure(() => Succeed("hi"));
  //    ^? const p2: () => Future<"hi", never>

  // @ts-expect-error Type 'Succeed<Map<string, number>>' is not assignable to type 'Try.Succeed<Json>'.
  Procedure(() => Succeed(new Map<string, number>()));

  const p3 = Procedure(() => Succeed({ ok: "OK" }));
  //    ^? const p3: () => Future<{ readonly ok: "OK"; }, never>

  const p4 = Procedure(async () => Succeed({ ok: "OK" }));
  //    ^? const p4: () => Future<{ readonly ok: "OK"; }, never>

  const p5 = Procedure(async () => Fail({ error: "💣" }));
  //    ^? const p5: () => Future<never, { readonly error: "💣"; }>

  const p6 = Procedure(async () => Future.resolve({ ok: "OK" }));
  //    ^? const p6: () => Future<{ ok: string; }, never>

  const p7 = Procedure(() => Future.reject({ error: "💣" }));
  //    ^? const p7: () => Future<never, { error: string; }>
});

test("the IO type must extend the message protocol data type", () => {
  // @ts-expect-error Type 'string' does not satisfy the constraint 'Message.DataType'.
  const { APIContract } = DataContract<string>();

  type IO = string | IO[] | { [key: string]: IO };

  // OK
  DataContract<IO>();
});

test("the IO types of the API contract are enforced ", () => {
  type IO = string | IO[] | { [key: string]: IO };

  const { APIContract } = DataContract<IO>();
  const { Procedure } = DataContract<Json>();

  APIContract({
    // @ts-expect-error Type 'number' is not assignable to type 'IO'.
    test: Procedure(() => 12)
  });
});

test("restricting the IO parameters of a generic procedure", () => {
  const { Procedure } = DataContract<Json>();

  // TODO: Can this be fixed?
  const p1 = Procedure(<T>(foo: T) => Succeed("hi"));
  //    ^? const p1: <T>(foo: Json) => Future<"hi", never>

  const p2 = Procedure(<T extends string>(foo: T) => Succeed("hi"));
  //    ^? const p2: <T extends string>(foo: T) => Future<"hi", never>

  const p3 = Procedure(<T extends Json>(foo: T) => Succeed("hi"));
  //    ^? const p3: <T extends Json>(foo: T) => Future<"hi", never>

  // @ts-expect-error Type 'Json' is not assignable to type 'Map<string, number>'.
  Procedure(<T extends Map<string, number>>(foo: T) => Succeed("hi"));
});

declare function test(message: string, callback: () => void): void;
