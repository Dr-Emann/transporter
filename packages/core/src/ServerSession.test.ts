import { expect, mock, spyOn, test } from "bun:test";
import * as DataContract from "./DataContract.js";
import * as Injector from "./Injector.js";
import * as Message from "./Message.js";
import * as ServerSession from "./ServerSession.js";

test("a session starts in an active state", () => {
  const { APIContract } = DataContract.DataContract();
  const session = ServerSession.ServerSession(APIContract({}));
  expect(session.state).toBe(ServerSession.State.Active);
  session.terminate();
});

test("terminating a session changes its state", () => {
  const { APIContract } = DataContract.DataContract();
  const session = ServerSession.ServerSession(APIContract({}));
  const next = mock();
  const complete = mock();
  session.stateChange.subscribe({ complete, next });
  session.terminate();
  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith(ServerSession.State.Terminated);
  expect(complete).toHaveBeenCalledTimes(1);
});

test("terminating a session completes the messageQueue", () => {
  const { APIContract } = DataContract.DataContract();
  const session = ServerSession.ServerSession(APIContract({}));
  const complete = mock();
  session.messageQueue.subscribe({ complete });
  session.terminate();
  expect(complete).toHaveBeenCalledTimes(1);
});

test("terminating a session using explicit resource management", () => {
  const next = mock();

  {
    const { APIContract } = DataContract.DataContract();
    using session = ServerSession.ServerSession(APIContract({}));
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
      value: "👍"
    })
  );
});

test("subscribing to a subscription puts a Next message on the messageQueue when a value is emitted", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();
  const test = Subscription<string>();
  const session = ServerSession.ServerSession(APIContract({ test }));
  const next = mock();

  session.messageQueue.subscribe(next);

  await session.sendAwait(
    Message.Subscribe({
      address: "",
      path: ["test"],
      returnAddress: "123"
    })
  );

  test.next("🤘");
  session.terminate();

  expect(next).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith(
    Message.Next({
      address: "123",
      path: ["test"],
      returnAddress: "",
      value: "🤘"
    })
  );
});

test("terminating a session unsubscribes from all subscriptions", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();
  const test = Subscription<string>();
  const session = ServerSession.ServerSession(APIContract({ test }));
  const spy = spyOn(test, "subscribe");
  const unsubscribe = mock(() => {});
  spy.mockImplementation(() => ({ unsubscribe }));

  await session.sendAwait(
    Message.Subscribe({
      address: "",
      path: ["test"],
      returnAddress: "123"
    })
  );

  session.terminate();

  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test("a message is not emitted if the subscription is not subscribed to", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();
  const test = Subscription<string>();
  const session = ServerSession.ServerSession(APIContract({ test }));
  const next = mock();

  session.messageQueue.subscribe(next);
  test.next("🤘");
  session.terminate();

  expect(next).toHaveBeenCalledTimes(0);
});

test("subscribing multiple times does not create multiple subscriptions", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();
  const test = Subscription<string>();
  const session = ServerSession.ServerSession(APIContract({ test }));
  const next = mock();

  session.messageQueue.subscribe(next);

  const message = Message.Subscribe({
    address: "",
    path: ["test"],
    returnAddress: "123"
  });

  await session.sendAwait(message);
  await session.sendAwait(message);

  test.next("🤘");
  session.terminate();

  expect(next).toHaveBeenCalledTimes(1);
});

test("unsubscribing terminates the subscription", async () => {
  const { Subscription, APIContract } = DataContract.DataContract();
  const test = Subscription<string>();
  const session = ServerSession.ServerSession(APIContract({ test }));
  const next = mock();

  session.messageQueue.subscribe(next);

  await session.sendAwait(
    Message.Subscribe({
      address: "",
      path: ["test"],
      returnAddress: "123"
    })
  );

  test.next("🤘");

  await session.sendAwait(
    Message.Unsubscribe({
      address: "",
      path: ["test"],
      returnAddress: "123"
    })
  );

  test.next("😘");
  session.terminate();

  expect(next).toHaveBeenCalledTimes(1);
});

test("using dependency injection", async () => {
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
      error: "incompatible version",
      returnAddress: ""
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
      error: "session terminated",
      returnAddress: ""
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
      error: "invalid message",
      returnAddress: ""
    })
  );
});

// sending a batch message

// calling a procedure that throws an error

function scheduleTask<R>(callback: () => R = () => undefined as R) {
  return new Promise<R>((resolve) => setTimeout(() => resolve(callback())));
}
