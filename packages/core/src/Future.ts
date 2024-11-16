const TYPE = "Future";
const type = Symbol.for("TYPE");

class Future<T = void, E = never> extends Promise<T> {
  [type] = TYPE;

  static reject<E>(reason?: E): Future<never, E> {
    const promise = Promise.reject(reason);
    Object.setPrototypeOf(promise, Future.prototype);
    return promise as Future<never, E>;
  }

  static resolve<T>(value?: PromiseLike<T> | T): Future<T, never> {
    const promise = Promise.resolve(value);
    Object.setPrototypeOf(promise, Future.prototype);
    return promise as Future<T>;
  }

  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: E) => void
    ) => void
  ) {
    super(executor);
  }

  then<T1 = T, T2 = never>(
    onfulfilled?: ((value: T) => T1 | PromiseLike<T1>) | undefined | null,
    onrejected?: ((reason: E) => T2 | PromiseLike<T2>) | undefined | null
  ): Future<T1 | T2> {
    return super.then(onfulfilled, onrejected) as Future<T1 | T2>;
  }

  catch<E1 = E, T1 = never>(
    onrejected?: ((reason: E1) => T1 | PromiseLike<T1>) | undefined | null
  ): Future<T | T1, E> {
    return super.catch(onrejected) as Future<T | T1, E>;
  }
}

type Flatten<F, E = never> = F extends Future<infer A, infer B>
  ? Flatten<A, E | B>
  : F extends Promise<infer A>
    ? Flatten<A>
    : Future<F, E>;

export { type Flatten, Future };
