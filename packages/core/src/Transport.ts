import * as BehaviorSubject from "./BehaviorSubject.js";
import * as Observable from "./Observable/Observable.js";

/**
 * The type of connection between the server and the client.
 */
enum ConnectionMode {
  /**
   * A message can be sent from one endpoint to another without prior
   * arrangement. For example, HTTP is a connectionless protocol.
   */
  Connectionless = "Connectionless",
  /**
   * A session or connection is established before data can be transmitted. For
   * example, TCP is a connection-oriented protocol.
   */
  ConnectionOriented = "ConnectionOriented"
}

enum ConnectionState {
  Connecting = "Connecting",
  Connected = "Connected",
  Closing = "Closing",
  Closed = "Closed"
}

interface Transport<TransferFormat, Mode extends ConnectionMode> {
  mode: Mode;
  send(message: TransferFormat): void;
  receive: Observable.t<TransferFormat>;
}

interface ConnectionlessTransport<TransferFormat>
  extends Transport<TransferFormat, ConnectionMode.Connectionless> {
  _tag: "ConnectionlessTransport";
}

interface ConnectionOrientedTransport<TransferFormat>
  extends Transport<TransferFormat, ConnectionMode.ConnectionOriented> {
  connectionState: BehaviorSubject.t<ConnectionState>;
  _tag: "ConnectionOrientedTransport";
}

export {
  type ConnectionlessTransport,
  type ConnectionOrientedTransport,
  type Transport,
  ConnectionMode,
  ConnectionState
};
