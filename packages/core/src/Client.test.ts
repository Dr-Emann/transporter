import { expect, test } from "bun:test";
import { type MessagePort } from "node:worker_threads";

import * as DataContract from "./DataContract.js";
import * as Client from "./Client.js";
import * as ServerSession from "./ServerSession.js";
import * as Subject from "./Subject.js";
import * as Transport from "./Transport.js";

// using a serializer
// using a server address
// abort a request?
// subscribing to a subscription
// subscribing to a subscription multiple times
// resubscribing to subscriptions when the connection state changes (only if there are subscriptions)
// an unsubscribe message is sent when all observers are unsubscribed
// observers are called when Next message is received
// non message messages are ignored
// messages with a different address are ignored
// receiving an error message
// receiving an invalid message type
// proxies are referentially stable
// a procedure named subscribe
// preventing promise chaining on a proxy?
// enumerating a proxy throws an error

test("calling a procedure", async () => {
  const { Procedure, APIContract } = DataContract.DataContract();

  const apiContract = APIContract({
    greet: Procedure(async (name: string) => `hello ${name}!`)
  });

  const session = ServerSession.ServerSession(apiContract);

  const messageChannel = new MessageChannel();
  const transport = MessageChannelTransport(messageChannel.port2);

  messageChannel.port1.onmessage = (event: MessageEvent) =>
    session.send(event.data);

  session.messageQueue.subscribe((message) =>
    messageChannel.port1.postMessage(message)
  );

  const client = Client.Client<
    typeof apiContract,
    Transport.ConnectionMode.ConnectionOriented
  >({
    transport
  });

  const reply = await client.greet("Ruby");

  session.terminate();

  expect(reply).toBe("hello Ruby!");
});

const MessageChannelTransport = (
  port: MessagePort
): Transport.ConnectionOrientedTransport<any> => {
  const connectionState = Subject.init<Transport.ConnectionState>();
  const receive = Subject.init();

  port.onmessage = (event) => receive.next(event.data);

  return {
    mode: Transport.ConnectionMode.ConnectionOriented,
    send: (message: any) => port.postMessage(message),
    receive: receive.asObservable(),
    connectionState: Transport.ConnectionState.Connected,
    connectionStateChange: connectionState.asObservable(),
    _tag: "ConnectionOrientedTransport"
  };
};
