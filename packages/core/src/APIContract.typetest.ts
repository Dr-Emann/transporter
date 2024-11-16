/* eslint-disable @typescript-eslint/no-unused-vars */
import { APIContract } from "./APIContract.js";
import { Json } from "./Json.js";
import { of } from "./Observable/index.js";
import { Procedure } from "./Procedure.js";
import { Subscription } from "./Subscription.js";

test("creating an API contract", () => {
  APIContract({
    test: Procedure(() => "hi")
  });
});

test("a serializer is required if the IO type and transfer format are incompatible", () => {
  const api = {
    test: Procedure(() => "hi")
  };

  // @ts-expect-error Arguments for the rest parameter 'options' were not provided
  APIContract<typeof api, Json, string>(api);

  // OK
  APIContract<typeof api, Json, Json>(api);
});

test("the API types must be compatible with the IO types", () => {
  const api = {
    test: Procedure(() => new Map<number, string>())
  };

  // @ts-expect-error Type 'Map<number, string>' is not assignable to type 'Json'.
  APIContract<typeof api, Json, Json>(api);
});

test("anything that is not a procedure or subscription is striped from the type", () => {
  const api = {
    bar: {
      baz: () => "😇",
      test2: Subscription(() => of(12))
    },
    foo: "👍",
    test: Procedure(() => "ok")
  };

  const contract = APIContract<typeof api, Json, Json>(api);

  contract.api;
  //       ^? (property) api: {
  //            bar: {
  //              test2: (observer: Observer<number>) => Future<Subscription, never>;
  //            };
  //            test: () => Future<string, never>;
  //          }
});

declare function test(message: string, callback: () => void): void;
