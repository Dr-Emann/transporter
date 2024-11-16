/* eslint-disable @typescript-eslint/no-unused-vars */
import { APIContract } from "./APIContract.js";
import { Json } from "./Json.js";
import { of } from "./Observable/index.js";
import { Procedure } from "./Procedure.js";
import { Subscription } from "./Subscription.js";

test("creating an API contract", () => {
  const contract = APIContract({ test: Procedure(() => "hi") });
  //    ^? const contract: APIContract<{
  //         readonly test: () => Future<string, never>;
  //       }, unknown, unknown>
});

test("the API types must be compatible with the IO types", () => {
  const api1 = {
    test: Procedure(() => new Map<number, string>())
  };

  // @ts-expect-error Type 'Map<number, string>' is not assignable to type 'Json'.
  APIContract<typeof api1, Json, Json>(api1);

  const api2 = {
    test: Subscription((foo: Map<string, number>) => of(12))
  };

  // @ts-expect-error Type 'Map<number, string>' is not assignable to type 'Json'.
  APIContract<typeof api2, Json, Json>(api2);

  const api3 = {
    test2: Subscription((foo: { [key: string]: number }) => of(1)),
    test: Procedure(() => "ok")
  };

  // OK
  APIContract<typeof api3, Json, Json>(api3);
});

test("anything that is not a procedure or subscription is striped from the type", () => {
  const api = {
    bar: {
      baz: () => "😇",
      test2: Subscription((foo: string) => of(1))
    },
    foo: "👍",
    test: Procedure(() => "ok")
  };

  const contract = APIContract<typeof api, Json, Json>(api);
  //    ^? const contract: APIContract<{
  //         bar: {
  //           test2: (foo: string, observer: Observer<number>) => Future<Subscription, never>;
  //         };
  //         test: () => Future<string, never>;
  //       }, Json, Json>
});

declare function test(message: string, callback: () => void): void;
