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

test("creating a data contract with a serializer", () => {
  const dataContract = DataContract({
    serializer: {
      serialize: (value: Json) => JSON.stringify(value),
      deserialize: (value: string) => JSON.parse(value) as Json
    }
  });

  dataContract;
  // ^? const dataContract: DataContract<Json, string>
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

declare function test(message: string, callback: () => void): void;
