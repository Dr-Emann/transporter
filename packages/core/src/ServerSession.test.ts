import { expect, mock, spyOn, test } from "bun:test";

import * as DataContract from "./DataContract.js";
import * as Injector from "./Injector.js";
import * as Json from "./Json.js";
import * as Message from "./Message.js";
import * as Observable from "./Observable/index.js";
import * as ServerSession from "./ServerSession.js";
import * as Subject from "./Subject.js";
import * as Subscription from "./Subscription.js";

test("a session starts in an active state", () => {
  const { APIContract } = DataContract.DataContract();
  const session = ServerSession.ServerSession(APIContract({}));
  expect(session.state).toBe(ServerSession.State.Active);
  session.terminate();
});

test("terminating a session changes its state", async () => {
  const { APIContract } = DataContract.DataContract();
  const session = ServerSession.ServerSession(APIContract({}));
  const next = mock();
  const complete = mock();
  session.stateChange.subscribe({ complete, next });
  await session.terminate();
  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith(ServerSession.State.Terminated);
  expect(complete).toHaveBeenCalledTimes(1);
});

test("terminating a session completes the messageQueue", async () => {
  const { APIContract } = DataContract.DataContract();
  const session = ServerSession.ServerSession(APIContract({}));
  const complete = mock();
  session.messageQueue.subscribe({ complete });
  await session.terminate();
  expect(complete).toHaveBeenCalledTimes(1);
});

test("terminating a session using explicit resource management", async () => {
  const next = mock();

  {
    const { APIContract } = DataContract.DataContract();
    await using session = ServerSession.ServerSession(APIContract({}));
    session.stateChange.subscribe(next);
  }

  expect(next).toHaveBeenCalledWith(ServerSession.State.Terminated);
});

test("sending a message to call a procedure calls the procedure and returns a message with the return value", async () => {
  const { Procedure, APIContract } = DataContract.DataContract();
  const procedure = mock(async () => "👍");

  const session = ServerSession.ServerSession(
    APIContract({
      test: Procedure(procedure)
    })
  );

  const message = await session.sendAwait(
    Message.Call({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(procedure).toHaveBeenCalledTimes(1);
  expect(message).toMatchObject(
    Message.Return({
      address: "123",
      returnAddress: "",
      traceId: expect.any(String),
      value: "👍"
    })
  );
});

test("the sendAwait API does not put a message on the messageQueue", async () => {
  const { Procedure, APIContract } = DataContract.DataContract();
  const next = mock();

  const session = ServerSession.ServerSession(
    APIContract({
      test: Procedure(async () => {})
    })
  );

  session.messageQueue.subscribe(next);

  await session.sendAwait(
    Message.Call({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(next).not.toHaveBeenCalled();
});

test("sending a message without awaiting the response pushes the message onto the messageQueue", async () => {
  const { Procedure, APIContract } = DataContract.DataContract();
  const next = mock();

  const session = ServerSession.ServerSession(
    APIContract({
      test: Procedure(async () => "👍")
    })
  );

  session.messageQueue.subscribe(next);

  session.send(
    Message.Call({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  await scheduleTask();
  session.terminate();

  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith(
    Message.Return({
      address: "123",
      returnAddress: "",
      traceId: expect.any(String),
      value: "👍"
    })
  );
});

test("using a serializer", async () => {
  const { Procedure, APIContract } = DataContract.DataContract<
    Json.t,
    string
  >();

  const serializer = {
    serialize: (value: Json.t) => JSON.stringify(value),
    deserialize: (value: string) => JSON.parse(value) as Json.t
  };

  const session = ServerSession.ServerSession(
    APIContract({
      test: Procedure(async () => "👍")
    }),
    { serializer }
  );

  const message = await session.sendAwait(
    serializer.serialize(
      Message.Call({
        address: "",
        args: [],
        path: ["test"],
        returnAddress: "123"
      })
    )
  );

  session.terminate();

  expect(message).toBeString();
  expect(serializer.deserialize(message!)).toMatchObject(
    Message.Return({
      address: "123",
      returnAddress: "",
      traceId: expect.any(String),
      value: "👍"
    })
  );
});

test("subscribing to a subscription puts an ObserverNext message on the messageQueue when a value is emitted", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();

  const test = Subscription(
    () => new Observable.Observable(({ next }) => next?.("🤘"))
  );

  const session = ServerSession.ServerSession(APIContract({ test }));
  const next = mock();

  session.messageQueue.subscribe(next);

  await session.sendAwait(
    Message.Subscribe({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith(
    Message.ObserverNext({
      address: "123",
      returnAddress: "",
      subscriptionId: expect.any(String),
      traceId: expect.any(String),
      value: "🤘"
    })
  );
});

test("terminating a session unsubscribes from all subscriptions", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();

  const unsubscribe = mock();

  const test = Subscription(() => {
    return new Observable.Observable(() => {
      return unsubscribe;
    });
  });

  const session = ServerSession.ServerSession(APIContract({ test }));

  await session.sendAwait(
    Message.Subscribe({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test.skip("subscribing multiple times does not create multiple subscriptions", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();

  const test = Subscription(() => Observable.of("🤘"));
  const session = ServerSession.ServerSession(APIContract({ test }));
  const next = mock();

  session.messageQueue.subscribe(next);

  const message = Message.Subscribe({
    address: "",
    args: [],
    path: ["test"],
    returnAddress: "123"
  });

  await session.sendAwait(message);
  await session.sendAwait(message);

  session.terminate();

  expect(next).toHaveBeenCalledTimes(1);
});

test("unsubscribing terminates the subscription", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();
  const subject = Subject.init<string>();

  const test = Subscription(async () => subject.asObservable());
  const session = ServerSession.ServerSession(APIContract({ test }));
  const next = mock();

  session.messageQueue.subscribe(next);

  const reply = (await session.sendAwait(
    Message.Subscribe({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  )) as Message.Subscribed;

  subject.next("🤘");

  const reply2 = await session.sendAwait(
    Message.Unsubscribe({
      address: "",
      subscriptionId: reply.subscriptionId,
      returnAddress: "123"
    })
  );

  subject.next("😘");
  await scheduleTask();
  session.terminate();

  expect(next).toHaveBeenCalledTimes(1);
  expect(reply2).toMatchObject(
    Message.Unsubscribed({
      address: "123",
      returnAddress: "",
      traceId: expect.any(String)
    })
  );
});

test("a subscription that completes", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();

  const test = Subscription(() => {
    return new Observable.Observable((observer) => {
      observer.complete?.();
    });
  });

  const session = ServerSession.ServerSession(APIContract({ test }));
  const next = mock();

  session.messageQueue.subscribe(next);

  await session.sendAwait(
    Message.Subscribe({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith(
    Message.ObserverComplete({
      address: "123",
      returnAddress: "",
      subscriptionId: expect.any(String),
      traceId: expect.any(String)
    })
  );
});

test("a subscription that errors", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();

  const test = Subscription(() => {
    return new Observable.Observable((observer) => {
      observer.error?.("💣");
    });
  });

  const session = ServerSession.ServerSession(APIContract({ test }));
  const next = mock();

  session.messageQueue.subscribe(next);

  await session.sendAwait(
    Message.Subscribe({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith(
    Message.ObserverError({
      address: "123",
      error: "💣",
      returnAddress: "",
      subscriptionId: expect.any(String),
      traceId: expect.any(String)
    })
  );
});

test("a subscription that throws", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();

  const test = Subscription(() => {
    throw "💣";
  });

  const session = ServerSession.ServerSession(APIContract({ test }));
  const next = mock();

  session.messageQueue.subscribe(next);

  const reply = await session.sendAwait(
    Message.Subscribe({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(next).toHaveBeenCalledTimes(0);
  expect(reply).toMatchObject(
    Message.Error({
      address: "123",
      error: "💣",
      returnAddress: "",
      traceId: expect.any(String)
    })
  );
});

test("using dependency injection with a procedure", async () => {
  const { Procedure, APIContract } = DataContract.DataContract();
  type Rocket = { blastoff(): string };
  const Rocket = Injector.Tag<Rocket>();

  const rocket: Rocket = {
    blastoff: mock(() => "🚀")
  };

  const injector = Injector.empty().add(Rocket, rocket);

  const procedure = Injector.provide([Rocket], async (rocket: Rocket) => {
    rocket.blastoff();
  });

  const session = ServerSession.ServerSession(
    APIContract({
      test: Procedure(procedure)
    }),
    { injector }
  );

  await session.sendAwait(
    Message.Call({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(rocket.blastoff).toHaveBeenCalledTimes(1);
});

test("using dependency injection with a subscription", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();
  type Rocket = { blastoff(): string };
  const Rocket = Injector.Tag<Rocket>();

  const rocket: Rocket = {
    blastoff: mock(() => "🚀")
  };

  const injector = Injector.empty().add(Rocket, rocket);

  const subscription = Injector.provide([Rocket], async (rocket: Rocket) => {
    rocket.blastoff();
    return Observable.of(1);
  });

  const session = ServerSession.ServerSession(
    APIContract({
      test: Subscription(subscription)
    }),
    { injector }
  );

  await session.sendAwait(
    Message.Subscribe({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(rocket.blastoff).toHaveBeenCalledTimes(1);
});

test("an error is returned if the value is not a procedure", async () => {
  const { APIContract } = DataContract.DataContract();

  const session = ServerSession.ServerSession(
    APIContract({
      test: async () => {}
    })
  );

  const reply = await session.sendAwait(
    Message.Call({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(reply).toMatchObject(
    Message.Error({
      address: "123",
      error: {
        message: "The value at path 'test' is not a procedure.",
        type: "TypeError"
      },
      returnAddress: "",
      traceId: expect.any(String)
    })
  );
});

test("an error is returned if the value is not a subscription", async () => {
  const { APIContract } = DataContract.DataContract();

  const session = ServerSession.ServerSession(
    APIContract({
      test: async () => {}
    })
  );

  const reply = await session.sendAwait(
    Message.Subscribe({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(reply).toMatchObject(
    Message.Error({
      address: "123",
      error: {
        message: "The value at path 'test' is not a subscription.",
        type: "TypeError"
      },
      returnAddress: "",
      traceId: expect.any(String)
    })
  );
});

test("giving a session an explicit address", async () => {
  const { Procedure, APIContract } = DataContract.DataContract();
  const procedure = mock(async () => "👍");

  const session = ServerSession.ServerSession(
    APIContract({
      test: Procedure(procedure)
    }),
    {
      address: "123"
    }
  );

  const message = await session.sendAwait(
    Message.Call({
      address: "123",
      args: [],
      path: ["test"],
      returnAddress: "321"
    })
  );

  session.terminate();

  expect(procedure).toHaveBeenCalledTimes(1);
  expect(message).toMatchObject(
    Message.Return({
      address: "321",
      returnAddress: "123",
      traceId: expect.any(String),
      value: "👍"
    })
  );
});

test("messages with a different address are ignored", async () => {
  const { Procedure, APIContract } = DataContract.DataContract();
  const procedure = mock(async () => "👍");

  const session = ServerSession.ServerSession(
    APIContract({
      test: Procedure(procedure)
    }),
    {
      address: "123"
    }
  );

  const message = Message.Call({
    address: "",
    args: [],
    path: ["test"],
    returnAddress: "321"
  });

  const response = await session.sendAwait(message);
  session.send(message);
  await scheduleTask();
  session.terminate();

  expect(procedure).toHaveBeenCalledTimes(0);
  expect(response).toBeUndefined();
});

test("an error is returned if the message version is incompatible", async () => {
  const { Procedure, APIContract } = DataContract.DataContract();
  const procedure = mock(async () => "👍");

  const session = ServerSession.ServerSession(
    APIContract({
      test: Procedure(procedure)
    })
  );

  const response = await session.sendAwait({
    ...Message.Call({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    }),
    version: "0.0.0"
  });

  session.terminate();

  expect(procedure).toHaveBeenCalledTimes(0);
  expect(response).toMatchObject(
    Message.Error({
      address: "123",
      error: {
        message:
          "Message with version 0.0.0 is not compatible with version 1.1.0.",
        type: "IncompatibleMessageError"
      },
      returnAddress: "",
      traceId: expect.any(String)
    })
  );
});

test("an error is returned if the session is terminated", async () => {
  const { Procedure, APIContract } = DataContract.DataContract();
  const procedure = mock(async () => "👍");

  const session = ServerSession.ServerSession(
    APIContract({
      test: Procedure(procedure)
    })
  );

  session.terminate();

  const response = await session.sendAwait(
    Message.Call({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  expect(procedure).toHaveBeenCalledTimes(0);
  expect(response).toMatchObject(
    Message.Error({
      address: "123",
      error: {
        message: "The session is terminated.",
        type: "SessionTerminatedError"
      },
      returnAddress: "",
      traceId: expect.any(String)
    })
  );
});

test("an error is returned if the wrong message type is received", async () => {
  const { Procedure, APIContract } = DataContract.DataContract();

  const session = ServerSession.ServerSession(
    APIContract({
      test: Procedure(async () => {})
    })
  );

  const response = await session.sendAwait(
    Message.Return({
      address: "",
      value: 1,
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(response).toMatchObject(
    Message.Error({
      address: "123",
      error: {
        message: "Message with type Return is invalid.",
        type: "InvalidMessageError"
      },
      returnAddress: "",
      traceId: expect.any(String)
    })
  );
});

test("sending a batch message", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();

  const sub1 = Subscription(
    () => new Observable.Observable(({ next }) => next?.("🤘"))
  );
  const sub2 = Subscription(
    () => new Observable.Observable(({ next }) => next?.("💩"))
  );
  const session = ServerSession.ServerSession(APIContract({ sub1, sub2 }));
  const next = mock();

  session.messageQueue.subscribe(next);

  const message = await session.sendAwait(
    Message.Batch({
      address: "",
      messages: [
        Message.Subscribe({
          address: "",
          args: [],
          path: ["sub1"],
          returnAddress: "abc"
        }),
        Message.Subscribe({
          address: "",
          args: [],
          path: ["sub2"],
          returnAddress: "xyz"
        })
      ],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(message).toMatchObject(
    Message.Batch({
      address: "123",
      messages: [
        Message.Subscribed({
          address: "abc",
          returnAddress: "",
          subscriptionId: expect.any(String),
          traceId: expect.any(String)
        }),
        Message.Subscribed({
          address: "xyz",
          returnAddress: "",
          subscriptionId: expect.any(String),
          traceId: expect.any(String)
        })
      ],
      returnAddress: "",
      traceId: expect.any(String)
    })
  );

  expect(next).toHaveBeenCalledTimes(2);

  expect(next).toHaveBeenCalledWith(
    Message.ObserverNext({
      address: "abc",
      subscriptionId: expect.any(String),
      traceId: expect.any(String),
      value: "🤘",
      returnAddress: ""
    })
  );

  expect(next).toHaveBeenCalledWith(
    Message.ObserverNext({
      address: "xyz",
      subscriptionId: expect.any(String),
      traceId: expect.any(String),
      value: "💩",
      returnAddress: ""
    })
  );
});

test("an error message is returned if a procedure throws an error", async () => {
  const { Procedure, APIContract } = DataContract.DataContract();

  const session = ServerSession.ServerSession(
    APIContract({
      test: Procedure(async () => {
        throw "💣";
      })
    })
  );

  const response = await session.sendAwait(
    Message.Call({
      address: "",
      args: [],
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(response).toMatchObject(
    Message.Error({
      address: "123",
      error: "💣",
      returnAddress: "",
      traceId: expect.any(String)
    })
  );
});

function scheduleTask<R>(callback: () => R = () => undefined as R) {
  return new Promise<R>((resolve) => setTimeout(() => resolve(callback())));
}
