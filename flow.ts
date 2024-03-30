type Entry<K, V> = [K, V];

class Item<T> {
  protected constructor(protected value: T | undefined | null) {}
  static of<T>(value: T | undefined | null): Item<T> {
    return new Item(value);
  }

  static empty<T>(): Item<T> {
    return new Item<T>(undefined);
  }

  flatMap<U>(mapper: (value: NonNullable<T>) => Item<U>): Item<U> {
    if (this.isEmpty()) return Item.empty();
    return mapper(this.value!);
  }

  map<U>(mapper: (value: NonNullable<T>) => U): Item<U> {
    if (this.isEmpty()) return Item.empty();
    return Item.of(mapper(this.value!));
  }

  filter(predicate: (value: NonNullable<T>) => boolean): Item<T> {
    if (this.isEmpty()) return this;
    return predicate(this.value!) ? this : Item.empty();
  }

  filterBy<U>(
    extractor: (value: NonNullable<T>) => U,
    predicate: (value: NonNullable<U>) => boolean,
  ): Item<T> {
    if (this.isEmpty()) return this;
    const mapped = extractor(this.value!);
    if (mapped == null) return Item.empty();
    return predicate(mapped!) ? this : Item.empty();
  }

  get(): T {
    return this.value!;
  }

  ifPresent(consumer: (value: NonNullable<T>) => void): void {
    if (this.isPresent()) consumer(this.value!);
  }

  ifPresentOrElse(consumer: (value: NonNullable<T>) => void, emptyAction: () => void): void {
    if (this.isPresent()) consumer(this.value!);
    else emptyAction();
  }

  isPresent(): boolean {
    return !this.isEmpty();
  }

  isEmpty(): boolean {
    return this.value == null;
  }

  or(supplier: () => Item<T>): Item<T> {
    return this.isPresent() ? this : supplier();
  }

  orElse(other: T): T {
    return this.isPresent() ? this.value! : other;
  }

  orElseGet(supplier: () => T): T {
    return this.isPresent() ? this.value! : supplier();
  }

  orElseThrow<E extends Error>(errorSupplier: () => E): T;
  orElseThrow<E extends Error>(error: E): T;
  orElseThrow<E extends Error>(supplierOrError: () => E): T {
    if (this.isEmpty())
      throw supplierOrError instanceof Error ? supplierOrError : supplierOrError();
    return this.value!;
  }

  flow(): Flow<T> {
    return this.isEmpty() ? Flow.empty() : Flow.of(this.value!);
  }
}

class Flow<T> {
  protected constructor(protected readonly iterators: IterableIterator<T>[]) {}
  static of<T>(set: Set<T>): Flow<T>;
  static of<T>(array: ArrayLike<T>): Flow<T>;
  static of<T>(iterator: IterableIterator<T>): Flow<T>;
  static of<T>(value: T): Flow<T>;
  static of<T>(...values: T[]): Flow<T>;
  static of<T>(): Flow<T> {
    const [valueOrValues, ...otherValues] = arguments;
    if (!otherValues.length && typeof valueOrValues?.[Symbol.iterator] === 'function') {
      return new Flow([valueOrValues[Symbol.iterator]()]);
    } else {
      return Flow.of([valueOrValues as T, ...(otherValues as T[])]);
    }
  }

  static split<T extends string>(
    value: string,
    splitter: { [Symbol.split](string: string, limit?: number): string[] },
    limit?: number,
  ): Flow<T> {
    return Flow.of(value.split(splitter, limit) as T[]);
  }

  static empty<T>(): Flow<T> {
    return new Flow([]);
  }

  static constant<T>(value: T, length: number = 1): Flow<T> {
    return Flow.of(Array.from({ length }, () => value)[Symbol.iterator]());
  }

  [Symbol.iterator]() {
    return (function* (iterables: Iterable<T>[]) {
      for (const iterable of iterables) {
        yield* iterable;
      }
    })(this.iterators);
  }

  append(values: Set<T>): Flow<T>;
  append(values: ArrayLike<T>): Flow<T>;
  append(values: IterableIterator<T>): Flow<T>;
  append(values: Flow<T>): Flow<T>;
  append(value: T): Flow<T>;
  append(...values: T[]): Flow<T>;
  append(): Flow<T> {
    const [valueOrValues, ...otherValues] = arguments;
    if (!otherValues.length && typeof valueOrValues?.[Symbol.iterator] === 'function') {
      return new Flow([...this.iterators, valueOrValues[Symbol.iterator]()]);
    } else {
      return new Flow([
        ...this.iterators,
        [valueOrValues as T, ...(otherValues as T[])][Symbol.iterator](),
      ]);
    }
  }

  prepend(values: Set<T>): Flow<T>;
  prepend(values: ArrayLike<T>): Flow<T>;
  prepend(values: IterableIterator<T>): Flow<T>;
  prepend(values: Flow<T>): Flow<T>;
  prepend(value: T): Flow<T>;
  prepend(...values: T[]): Flow<T>;
  prepend(): Flow<T> {
    const [valueOrValues, ...otherValues] = arguments;
    if (!otherValues.length && typeof valueOrValues?.[Symbol.iterator] === 'function') {
      return new Flow([valueOrValues[Symbol.iterator](), ...this.iterators]);
    } else {
      return new Flow([
        [valueOrValues as T, ...(otherValues as T[])][Symbol.iterator](),
        ...this.iterators,
      ]);
    }
  }

  flat(): Flow<T extends (infer U)[] ? U : T> {
    return Flow.of(
      (function* (iterable: Iterable<T>) {
        for (const value of iterable) {
          yield* Array.isArray(value) ? value : [value];
        }
      })(this),
    );
  }

  flatMap<U>(mapper: (value: T, index?: number) => U[]): Flow<U> {
    return Flow.of(
      (function* (iterable: Iterable<T>) {
        let index = 0;
        for (const value of iterable) {
          yield* mapper(value, index);
          index++;
        }
      })(this),
    );
  }

  map<U>(mapper: (value: T, index?: number) => U): Flow<U> {
    return Flow.of(
      (function* (iterable: Iterable<T>) {
        let index = 0;
        for (const value of iterable) {
          yield mapper(value, index);
          index++;
        }
      })(this),
    );
  }

  mapToEntry<K, V>(
    keyMapper: (value: T, index?: number) => K,
    valueMapper: (value: T, index?: number) => V,
  ): EntryFlow<K, V> {
    return EntryFlow.of(
      (function* (iterable: Iterable<T>) {
        let index = 0;
        for (const value of iterable) {
          yield [keyMapper(value, index), valueMapper(value, index)];
          index++;
        }
      })(this),
    );
  }

  filter(predicate: (value: T, index?: number) => boolean): Flow<T> {
    return Flow.of(
      (function* (iterable: Iterable<T>) {
        let index = 0;
        for (const value of iterable) {
          if (predicate(value, index)) {
            yield value;
          }
          index++;
        }
      })(this),
    );
  }

  filterBy<U>(
    extractor: (value: T, index?: number) => U,
    predicate: (mapped: U, index?: number) => boolean,
  ): Flow<T> {
    return Flow.of(
      (function* (iterable: Iterable<T>) {
        let index = 0;
        for (const value of iterable) {
          if (predicate(extractor(value, index), index)) {
            yield value;
          }
          index++;
        }
      })(this),
    );
  }

  remove(predicate: (value: T, index?: number) => boolean): Flow<T> {
    return this.filter((value, index) => !predicate(value, index));
  }

  removeBy<U>(
    extractor: (value: T, index?: number) => U,
    predicate: (mapped: U, index?: number) => boolean,
  ): Flow<T> {
    return this.filterBy(extractor, (mapped, index) => !predicate(mapped, index));
  }

  without(value: T): Flow<T>;
  without(...values: T[]): Flow<T>;
  without() {
    const filtered = new Set(arguments);
    return this.filter((value) => !filtered.has(value));
  }

  nonNull(): Flow<NonNullable<T>> {
    return this.filter((value) => value != null) as Flow<NonNullable<T>>;
  }

  sort(): Flow<T>;
  sort(comparator: (x: T, y: T) => number): Flow<T>;
  sort(comparator?: (x: T, y: T) => number): Flow<T> {
    return Flow.of(Array.from(this).sort(comparator));
  }

  sortBy<U>(extractor: (value: T) => U, comparator: (x: U, y: U) => number): Flow<T> {
    return Flow.of(
      Array.from(this).sort((x, y) => comparator(extractor(x), extractor(y))),
    );
  }

  reverse(): Flow<T> {
    return Flow.of(Array.from(this).reverse());
  }

  distinct(): Flow<T> {
    return Flow.of(new Set(this));
  }

  peek(consumer: (value: T, index?: number) => void): Flow<T> {
    return Flow.of(
      (function* (iterable: Iterable<T>) {
        let index = 0;
        for (const value of iterable) {
          consumer(value, index);
          yield value;
          index++;
        }
      })(this),
    );
  }

  findFirst(): Item<T> {
    for (const value of this) {
      return Item.of(value);
    }
    return Item.empty();
  }

  some(predicate: (value: T, index?: number) => boolean): boolean {
    let index = 0;
    for (const value of this) {
      if (predicate(value, index)) return true;
      index++;
    }
    return false;
  }

  every(predicate: (value: T, index?: number) => boolean): boolean {
    let index = 0;
    for (const value of this) {
      if (!predicate(value, index)) return false;
      index++;
    }
    return true;
  }

  none(predicate: (value: T, index?: number) => boolean): boolean {
    return !this.some(predicate);
  }

  forEach(consumer: (value: T, index?: number) => void): void {
    let index = 0;
    for (const value of this) {
      consumer(value, index);
      index++;
    }
  }

  count(): number {
    let count = 0;
    for (const _ of this) {
      count++;
    }
    return count;
  }

  join(): string;
  join(delimiter: string): string;
  join(delimeter: string, prefix: string, suffix: string): string;
  join(delimeter?: string, prefix?: string, suffix?: string): string {
    return `${prefix ?? ''}${this.toArray().join(delimeter)}${suffix ?? ''}`;
  }

  into(set: Set<T>): Set<T>;
  into(array: Array<T>): Array<T>;
  into(array: T[]): T[];
  into(setOrArray: Set<T> | Array<T> | T[]) {
    for (const value of this) {
      if (setOrArray instanceof Set) {
        setOrArray.add(value);
      } else {
        setOrArray.push(value);
      }
    }
    return setOrArray;
  }

  reduce<U>(
    reducer: (accumulator: U, value: T, index?: number) => U,
    initialValue: U,
  ): U {
    let index = 0;
    let accumulator = initialValue;
    for (const value of this) {
      accumulator = reducer(accumulator, value, index);
      index++;
    }
    return accumulator;
  }

  toArray(): T[] {
    return Array.from(this);
  }

  toSet(): Set<T> {
    return new Set(this);
  }

  toMap<K, V>(keyExtractor: (value: T) => K, valueExtractor: (value: T) => V): Map<K, V> {
    return this.reduce((acc, value) => acc.set(keyExtractor(value), valueExtractor(value)), new Map<K, V>());
  }

  toJsonString(): string {
    return JSON.stringify(this.toArray());
  }
}

class EntryFlow<K, V> {
  protected constructor(protected readonly iterators: IterableIterator<Entry<K, V>>[]) {}
  static of<K, V>(iterator: IterableIterator<Entry<K, V>>): EntryFlow<K, V>;
  static of<K, V>(map: Map<K, V>): EntryFlow<K, V>;
  static of<K extends keyof any, V>(record: Record<K, V>): EntryFlow<K, V>;
  static of<K, V>(): EntryFlow<K, V> {
    const [valueOrValues] = arguments;
    if (typeof valueOrValues?.[Symbol.iterator] === 'function') {
      return new EntryFlow([valueOrValues[Symbol.iterator]()]);
    } else {
      return new EntryFlow([
        (Object.entries(valueOrValues) as Entry<K, V>[])[Symbol.iterator](),
      ]);
    }
  }

  static empty<K, V>(): EntryFlow<K, V> {
    return new EntryFlow([]);
  }

  [Symbol.iterator]() {
    return (function* (iterables: Iterable<Entry<K, V>>[]) {
      for (const iterable of iterables) {
        yield* iterable;
      }
    })(this.iterators);
  }

  append(iterator: IterableIterator<Entry<K, V>>): EntryFlow<K, V>;
  append(map: Map<K, V>): EntryFlow<K, V>;
  append<T extends keyof any, V>(record: Record<T, V>): EntryFlow<T | K, V>;
  append(): EntryFlow<K, V> {
    const [valueOrValues] = arguments;
    if (typeof valueOrValues?.[Symbol.iterator] === 'function') {
      return new EntryFlow([valueOrValues[Symbol.iterator](), ...this.iterators]);
    } else {
      return new EntryFlow([
        (Object.entries(valueOrValues) as Entry<K, V>[])[Symbol.iterator](),
        ...this.iterators,
      ]);
    }
  }

  prepend(iterator: IterableIterator<Entry<K, V>>): EntryFlow<K, V>;
  prepend(map: Map<K, V>): EntryFlow<K, V>;
  prepend<T extends keyof any, V>(record: Record<T, V>): EntryFlow<T | K, V>;
  prepend(): EntryFlow<K, V> {
    const [valueOrValues] = arguments;
    if (typeof valueOrValues?.[Symbol.iterator] === 'function') {
      return new EntryFlow([valueOrValues[Symbol.iterator](), ...this.iterators]);
    } else {
      return new EntryFlow([
        ...this.iterators,
        (Object.entries(valueOrValues) as Entry<K, V>[])[Symbol.iterator](),
      ]);
    }
  }

  flatMap<U, W>(
    mapper: (key: K, value: V, index?: number) => Entry<U, W>[],
  ): EntryFlow<U, W> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let index = 0;
        for (const [key, value] of iterable) {
          yield* mapper(key, value, index);
          index++;
        }
      })(this),
    );
  }

  map<U, W>(mapper: (key: K, value: V, index?: number) => Entry<U, W>): EntryFlow<U, W> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let index = 0;
        for (const [key, value] of iterable) {
          yield mapper(key, value, index);
          index++;
        }
      })(this),
    );
  }

  flatMapKeys<U>(mapper: (key: K, index?: number) => U[]): EntryFlow<U, V> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let index = 0;
        for (const [key, value] of iterable) {
          yield* mapper(key, index).map((mappedKey) => [mappedKey, value] as Entry<U, V>);
          index++;
        }
      })(this),
    );
  }

  mapKeys<U>(mapper: (key: K, index?: number) => U): EntryFlow<U, V> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let index = 0;
        for (const [key, value] of iterable) {
          yield [mapper(key, index), value];
          index++;
        }
      })(this),
    );
  }

  flatMapValues<W>(mapper: (value: V, index?: number) => W[]): EntryFlow<K, W> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let index = 0;
        for (const [key, value] of iterable) {
          yield* mapper(value, index).map(
            (mappedValue) => [key, mappedValue] as Entry<K, W>,
          );
          index++;
        }
      })(this),
    );
  }

  mapValues<W>(mapper: (value: V, index?: number) => W): EntryFlow<K, W> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let index = 0;
        for (const [key, value] of iterable) {
          yield [key, mapper(value, index)];
          index++;
        }
      })(this),
    );
  }

  filter(predicate: (key: K, value: V, index?: number) => boolean): EntryFlow<K, V> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let index = 0;
        for (const entry of iterable) {
          if (predicate(entry[0], entry[1], index)) {
            yield entry;
          }
          index++;
        }
      })(this),
    );
  }

  filterKeys(predicate: (key: K, index?: number) => boolean): EntryFlow<K, V> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let index = 0;
        for (const entry of iterable) {
          if (predicate(entry[0], index)) {
            yield entry;
          }
          index++;
        }
      })(this),
    );
  }

  filterValues(predicate: (value: V, index?: number) => boolean): EntryFlow<K, V> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let index = 0;
        for (const entry of iterable) {
          if (predicate(entry[1], index)) {
            yield entry;
            index++;
          }
        }
      })(this),
    );
  }

  remove(predicate: (key: K, value: V, index?: number) => boolean): EntryFlow<K, V> {
    return this.filter((key, value) => !predicate(key, value));
  }

  removeKeys(predicate: (key: K, index?: number) => boolean): EntryFlow<K, V> {
    return this.filterKeys((key) => !predicate(key));
  }

  removeValues(predicate: (value: V, index?: number) => boolean): EntryFlow<K, V> {
    return this.filterValues((value) => !predicate(value));
  }

  nonNullKeys(): EntryFlow<NonNullable<K>, V> {
    return this.filterKeys((key) => key != null) as EntryFlow<NonNullable<K>, V>;
  }

  nonNullValues(): EntryFlow<K, NonNullable<V>> {
    return this.filterValues((value) => value != null) as EntryFlow<K, NonNullable<V>>;
  }

  sortKeys(comparator: (k1: K, k2: K) => number): EntryFlow<K, V> {
    return EntryFlow.of(
      Array.from(this)
        .sort((e1, e2) => comparator(e1[0], e2[0]))
        [Symbol.iterator](),
    );
  }

  sortValues(comparator: (v1: V, v2: V) => number): EntryFlow<K, V> {
    return EntryFlow.of(
      Array.from(this)
        .sort((e1, e2) => comparator(e1[1], e2[1]))
        [Symbol.iterator](),
    );
  }

  reverse(): EntryFlow<K, V> {
    return EntryFlow.of(Array.from(this).reverse()[Symbol.iterator]());
  }

  distinctKeys(): EntryFlow<K, V> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        const keys = new Set<K>();
        for (const entry of iterable) {
          if (!keys.has(entry[0])) {
            yield entry;
            keys.add(entry[0]);
          }
        }
      })(this),
    );
  }

  distinctValues(): EntryFlow<K, V> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        const values = new Set<V>();
        for (const entry of iterable) {
          if (!values.has(entry[1])) {
            yield entry;
            values.add(entry[1]);
          }
        }
      })(this),
    );
  }

  collapseKeys(): EntryFlow<K, V[]> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let collapseKey: K | undefined = undefined;
        let collapseValues: V[] = [];
        for (const [key, value] of iterable) {
          if (collapseKey && collapseKey !== key) {
            yield [collapseKey, collapseValues];
            collapseValues = [];
          }
          collapseKey = key;
          collapseValues.push(value);
        }
        if (collapseKey) {
          yield [collapseKey, collapseValues];
        }
      })(this),
    );
  }

  grouping(): EntryFlow<K, V[]> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let map = new Map<K, V[]>();
        for (const [key, value] of iterable) {
          if (!map.has(key)) {
            map.set(key, []);
          }
          map.get(key)!.push(value);
        }
        yield* map.entries();
      })(this),
    );
  }

  invert(): EntryFlow<V, K> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        for (const [key, value] of iterable) {
          yield [value, key];
        }
      })(this),
    );
  }

  peek(consumer: (key: K, value: V, index?: number) => void): EntryFlow<K, V> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let index = 0;
        for (const entry of iterable) {
          consumer(entry[0], entry[1], index);
          yield entry;
          index++;
        }
      })(this),
    );
  }

  peekKeys(consumer: (key: K, index?: number) => void): EntryFlow<K, V> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let index = 0;
        for (const entry of iterable) {
          consumer(entry[0], index);
          yield entry;
          index++;
        }
      })(this),
    );
  }

  peekValues(consumer: (value: V, index?: number) => void): EntryFlow<K, V> {
    return EntryFlow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        let index = 0;
        for (const entry of iterable) {
          consumer(entry[1], index);
          yield entry;
          index++;
        }
      })(this),
    );
  }

  findFirst(): Item<Entry<K, V>> {
    for (const value of this) {
      return Item.of(value);
    }
    return Item.empty();
  }

  findFirstKey(): Item<K> {
    for (const [key] of this) {
      return Item.of(key);
    }
    return Item.empty();
  }

  findFirstValue(): Item<V> {
    for (const [_, value] of this) {
      return Item.of(value);
    }
    return Item.empty();
  }

  some(predicate: (key: K, value: V, index?: number) => boolean): boolean {
    let index = 0;
    for (const [key, value] of this) {
      if (predicate(key, value, index)) return true;
      index++;
    }
    return false;
  }

  every(predicate: (key: K, value: V, index?: number) => boolean): boolean {
    let index = 0;
    for (const [key, value] of this) {
      if (!predicate(key, value, index)) return false;
      index++;
    }
    return true;
  }

  none(predicate: (key: K, value: V, index?: number) => boolean): boolean {
    return !this.some(predicate);
  }

  forEach(consumer: (key: K, value: V, index?: number) => void): void {
    let index = 0;
    for (const [key, value] of this) {
      consumer(key, value, index);
      index++;
    }
  }

  count(): number {
    let count = 0;
    for (const _ of this) {
      count++;
    }
    return count;
  }

  keys(): Flow<K> {
    return Flow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        for (const [key] of iterable) {
          yield key;
        }
      })(this),
    );
  }

  values(): Flow<V> {
    return Flow.of(
      (function* (iterable: Iterable<Entry<K, V>>) {
        for (const [, value] of iterable) {
          yield value;
        }
      })(this),
    );
  }

  flow(): Flow<Entry<K, V>> {
    return Flow.of(this.toArray());
  }

  into(map: Map<K, V>): Map<K, V> {
    for (const [key, value] of this) {
      map.set(key, value);
    }
    return map;
  }

  reduce<U>(
    reducer: (accumulator: U, key: K, value: V, index?: number) => U,
    initialValue: U,
  ): U {
    let index = 0;
    let accumulator = initialValue;
    for (const [key, value] of this) {
      accumulator = reducer(accumulator, key, value, index);
      index++;
    }
    return accumulator;
  }

  toArray(): Entry<K, V>[] {
    return Array.from(this);
  }

  toMap(): Map<K, V> {
    return this.reduce((acc, key, value) => acc.set(key, value), new Map<K, V>());
  }

  toJsonString(): string {
    return JSON.stringify(this.toMap());
  }
}

class PromiseItem<T>
  extends Promise<T | undefined | null>
  implements PromiseLike<T | undefined | null>
{
  static of<T>(
    value: T | undefined | null | PromiseLike<Awaited<T> | undefined | null>,
  ): PromiseItem<T> {
    return new PromiseItem((resolve) => resolve(value));
  }

  static empty<T>(): PromiseItem<T> {
    return new PromiseItem((resolve) => resolve(undefined));
  }

  map<U>(mapper: (value: NonNullable<T>) => U | PromiseLike<Awaited<U>>): PromiseItem<U> {
    return new PromiseItem((resolve, reject) =>
      this.then((value) => {
        try {
          resolve(value == null ? undefined : mapper(value));
        } catch (error) {
          reject(error);
        }
      }, reject),
    );
  }

  mapError<U>(mapper: (error: any) => U | PromiseLike<Awaited<U>>): PromiseItem<U> {
    return new PromiseItem((resolve, reject) =>
      this.catch((error) => {
        try {
          resolve(mapper(error));
        } catch (error) {
          reject(error);
        }
      }),
    );
  }

  filter(predicate: (value: NonNullable<T>) => boolean): PromiseItem<T> {
    return new PromiseItem((resolve, reject) =>
      this.then((value) => {
        try {
          if (value == null) resolve(undefined);
          else if (predicate(value)) resolve(value);
          else resolve(undefined);
        } catch (error) {
          reject(error);
        }
      }, reject),
    );
  }

  filterBy<U>(
    extractor: (value: NonNullable<T>) => U,
    predicate: (value: NonNullable<U>) => boolean,
  ): PromiseItem<T> {
    return new PromiseItem((resolve, reject) =>
      this.then((value) => {
        try {
          if (value == null) resolve(undefined);
          const mapped = extractor(value!);
          if (mapped == null) resolve(undefined);
          else if (predicate(mapped)) resolve(value);
          else resolve(undefined);
        } catch (error) {
          reject(error);
        }
      }, reject),
    );
  }

  remove(predicate: (value: NonNullable<T>) => boolean): PromiseItem<T> {
    return new PromiseItem((resolve, reject) =>
      this.then((value) => {
        try {
          if (value == null) resolve(undefined);
          else if (predicate(value)) resolve(undefined);
          else resolve(value);
        } catch (error) {
          reject(error);
        }
      }, reject),
    );
  }

  removeBy<U>(
    extractor: (value: NonNullable<T>) => U,
    predicate: (value: NonNullable<U>) => boolean,
  ): PromiseItem<T> {
    return new PromiseItem((resolve, reject) =>
      this.then((value) => {
        try {
          if (value == null) resolve(undefined);
          const mapped = extractor(value!);
          if (mapped == null) resolve(undefined);
          else if (predicate(mapped)) resolve(undefined);
          else resolve(value);
        } catch (error) {
          reject(error);
        }
      }, reject),
    );
  }

  ifPresent(consumer: (value: NonNullable<T>) => void): PromiseItem<T> {
    return new PromiseItem((resolve, reject) =>
      this.then((value) => {
        try {
          if (value != null) consumer(value!);
          resolve(value);
        } catch (error) {
          reject(error);
        }
      }, reject),
    );
  }

  ifEmpty(emptyAction: () => void): PromiseItem<T> {
    return new PromiseItem((resolve, reject) =>
      this.then((value) => {
        try {
          if (value == null) emptyAction();
          resolve(value);
        } catch (error) {
          reject(error);
        }
      }, reject),
    );
  }

  ifThrown(consumer: (value: any) => void): PromiseItem<T> {
    return new PromiseItem((resolve, reject) =>
      this.then(resolve, (error) => {
        try {
          if (error != null) consumer(error);
          reject(error);
        } catch (_) {
          reject(error);
        }
      }),
    );
  }

  isPresent(): PromiseItem<boolean> {
    return new PromiseItem((resolve, reject) =>
      this.then((value) => resolve(value != null), reject),
    );
  }

  isEmpty(): PromiseItem<boolean> {
    return new PromiseItem((resolve, reject) =>
      this.then((value) => resolve(value == null), reject),
    );
  }

  or(supplier: () => PromiseItem<T>): PromiseItem<T> {
    return new PromiseItem((resolve, reject) =>
      this.then((value) => {
        if (value != null) resolve(value);
        else resolve(supplier());
      }, reject),
    );
  }

  orElse(other: T | PromiseLike<Awaited<T>>): PromiseItem<T> {
    return new PromiseItem((resolve, reject) =>
      this.then((value) => {
        try {
          if (value != null) resolve(value);
          else resolve(other);
        } catch (error) {
          reject(error);
        }
      }, reject),
    );
  }

  orElseGet(supplier: () => T | PromiseLike<Awaited<T>>): PromiseItem<T> {
    return new PromiseItem((resolve, reject) =>
      this.then((value) => {
        try {
          if (value != null) resolve(value);
          else resolve(supplier());
        } catch (error) {
          reject(error);
        }
      }, reject),
    );
  }

  orElseThrow(errorSupplier: () => any): PromiseItem<T>;
  orElseThrow(error: any): PromiseItem<T>;
  orElseThrow(supplierOrError: () => any): PromiseItem<T> {
    return new PromiseItem<T>((resolve, reject) =>
      this.then((value) => {
        try {
          if (value != null) resolve(value);
          else
            reject(
              typeof supplierOrError === 'function' ? supplierOrError() : supplierOrError,
            );
        } catch (error) {
          reject(error);
        }
      }, reject),
    );
  }
}

class PromiseFlow<T> {
  protected constructor(protected readonly iterators: AsyncIterableIterator<T>[]) {}
  static of<T>(set: Set<Promise<T>>): PromiseFlow<T>;
  static of<T>(array: ArrayLike<Promise<T>>): PromiseFlow<T>;
  static of<T>(iterator: IterableIterator<Promise<T>>): PromiseFlow<T>;
  static of<T>(iterator: AsyncIterableIterator<T>): PromiseFlow<T>;
  static of<T>(value: Promise<T>): PromiseFlow<T>;
  static of<T>(...values: Promise<T>[]): PromiseFlow<T>;
  static of<T>(): PromiseFlow<T> {
    const [valueOrValues, ...otherValues] = arguments;
    if (typeof valueOrValues?.[Symbol.asyncIterator] === 'function') {
      return new PromiseFlow([valueOrValues[Symbol.asyncIterator]()]);
    } else if (
      !otherValues.length &&
      typeof valueOrValues?.[Symbol.iterator] === 'function'
    ) {
      return new PromiseFlow([
        (async function* (iterable: Iterable<Promise<T>>) {
          yield* iterable;
        })(valueOrValues[Symbol.iterator]()),
      ]);
    } else {
      return PromiseFlow.of([
        valueOrValues as Promise<T>,
        ...(otherValues as Promise<T>[]),
      ]);
    }
  }

  static empty<T>(): PromiseFlow<T> {
    return new PromiseFlow([]);
  }

  [Symbol.asyncIterator]() {
    return (async function* (iterables: AsyncIterable<T>[]) {
      for (const iterable of iterables) {
        yield* iterable;
      }
    })(this.iterators);
  }

  append(set: Set<Promise<T>>): PromiseFlow<T>;
  append(array: ArrayLike<Promise<T>>): PromiseFlow<T>;
  append(iterator: IterableIterator<Promise<T>>): PromiseFlow<T>;
  append(iterator: AsyncIterableIterator<T>): PromiseFlow<T>;
  append(value: Promise<T>): PromiseFlow<T>;
  append(...values: Promise<T>[]): PromiseFlow<T>;
  append(): PromiseFlow<T> {
    const [valueOrValues, ...otherValues] = arguments;
    if (typeof valueOrValues?.[Symbol.asyncIterator] === 'function') {
      return new PromiseFlow([valueOrValues[Symbol.asyncIterator](), ...this.iterators]);
    } else if (
      !otherValues.length &&
      typeof valueOrValues?.[Symbol.iterator] === 'function'
    ) {
      return new PromiseFlow([
        (async function* (iterable: Iterable<Promise<T>>) {
          yield* iterable;
        })(valueOrValues[Symbol.iterator]()),
        ...this.iterators,
      ]);
    } else {
      return new PromiseFlow([
        (async function* (iterable: Iterable<Promise<T>>) {
          yield* iterable;
        })(
          [valueOrValues as Promise<T>, ...(otherValues as Promise<T>[])][
            Symbol.iterator
          ](),
        ),
        ...this.iterators,
      ]);
    }
  }

  prepend(set: Set<Promise<T>>): PromiseFlow<T>;
  prepend(array: ArrayLike<Promise<T>>): PromiseFlow<T>;
  prepend(iterator: IterableIterator<Promise<T>>): PromiseFlow<T>;
  prepend(iterator: AsyncIterableIterator<T>): PromiseFlow<T>;
  prepend(value: Promise<T>): PromiseFlow<T>;
  prepend(...values: Promise<T>[]): PromiseFlow<T>;
  prepend(): PromiseFlow<T> {
    const [valueOrValues, ...otherValues] = arguments;
    if (typeof valueOrValues?.[Symbol.asyncIterator] === 'function') {
      return new PromiseFlow([...this.iterators, valueOrValues[Symbol.asyncIterator]()]);
    } else if (
      !otherValues.length &&
      typeof valueOrValues?.[Symbol.iterator] === 'function'
    ) {
      return new PromiseFlow([
        ...this.iterators,
        (async function* (iterable: Iterable<Promise<T>>) {
          yield* iterable;
        })(valueOrValues[Symbol.iterator]()),
      ]);
    } else {
      return new PromiseFlow([
        ...this.iterators,
        (async function* (iterable: Iterable<Promise<T>>) {
          yield* iterable;
        })(
          [valueOrValues as Promise<T>, ...(otherValues as Promise<T>[])][
            Symbol.iterator
          ](),
        ),
      ]);
    }
  }

  flat(): PromiseFlow<T extends (infer U)[] ? U : T> {
    return PromiseFlow.of(
      (async function* (iterable: AsyncIterable<T>) {
        for await (const value of iterable) {
          yield* Array.isArray(value) ? value : [value];
        }
      })(this),
    );
  }

  flatMap<U>(mapper: (value: T, index?: number) => Promise<U>): PromiseFlow<U> {
    return PromiseFlow.of(
      (async function* (iterable: AsyncIterable<T>) {
        let index = 0;
        for await (const value of iterable) {
          yield await mapper(value, index);
          index++;
        }
      })(this),
    );
  }

  map<U>(mapper: (value: T, index?: number) => U): PromiseFlow<U> {
    return PromiseFlow.of(
      (async function* (iterable: AsyncIterable<T>) {
        let index = 0;
        for await (const value of iterable) {
          yield mapper(value, index);
          index++;
        }
      })(this),
    );
  }

  filter(predicate: (value: T, index?: number) => boolean): PromiseFlow<T> {
    return PromiseFlow.of(
      (async function* (iterable: AsyncIterable<T>) {
        let index = 0;
        for await (const value of iterable) {
          if (predicate(value, index)) {
            yield value;
          }
          index++;
        }
      })(this),
    );
  }

  filterBy<U>(
    extractor: (value: T, index?: number) => U,
    predicate: (mapped: U, index?: number) => boolean,
  ): PromiseFlow<T> {
    return PromiseFlow.of(
      (async function* (iterable: AsyncIterable<T>) {
        let index = 0;
        for await (const value of iterable) {
          if (predicate(extractor(value, index), index)) {
            yield value;
          }
          index++;
        }
      })(this),
    );
  }

  remove(predicate: (value: T, index?: number) => boolean): PromiseFlow<T> {
    return this.filter((value, index) => !predicate(value, index));
  }

  removeBy<U>(
    extractor: (value: T, index?: number) => U,
    predicate: (mapped: U, index?: number) => boolean,
  ): PromiseFlow<T> {
    return this.filterBy(extractor, (mapped, index) => !predicate(mapped, index));
  }

  nonNull(): PromiseFlow<NonNullable<T>> {
    return this.filter((value) => value != null) as PromiseFlow<NonNullable<T>>;
  }

  sort(): PromiseFlow<T>;
  sort(comparator: (x: T, y: T) => number): PromiseFlow<T>;
  sort(comparator?: (x: T, y: T) => number): PromiseFlow<T> {
    return PromiseFlow.of(
      (async function* (iterable: AsyncIterable<T>) {
        const values: T[] = [];
        for await (const value of iterable) {
          values.push(value);
        }
        yield* values.sort(comparator);
      })(this),
    );
  }

  sortBy<U>(
    extractor: (value: T) => U,
    comparator: (x: U, y: U) => number,
  ): PromiseFlow<T> {
    return PromiseFlow.of(
      (async function* (iterable: AsyncIterable<T>) {
        const values: T[] = [];
        for await (const value of iterable) {
          values.push(value);
        }
        yield* values.sort((x, y) => comparator(extractor(x), extractor(y)));
      })(this),
    );
  }

  reverse(): PromiseFlow<T> {
    return PromiseFlow.of(
      (async function* (iterable: AsyncIterable<T>) {
        const values: T[] = [];
        for await (const value of iterable) {
          values.push(value);
        }
        yield* values.reverse();
      })(this),
    );
  }

  distinct(): PromiseFlow<T> {
    return PromiseFlow.of(
      (async function* (iterable: AsyncIterable<T>) {
        const set = new Set<T>();
        for await (const value of iterable) {
          set.add(value);
        }
        yield* set;
      })(this),
    );
  }

  peek(consumer: (value: T, index?: number) => void): PromiseFlow<T> {
    return PromiseFlow.of(
      (async function* (iterable: AsyncIterable<T>) {
        let index = 0;
        for await (const value of iterable) {
          consumer(value, index);
          yield value;
          index++;
        }
      })(this),
    );
  }

  async findFirst(): Promise<Item<T>> {
    for await (const value of this) {
      return Item.of(value);
    }
    return Item.empty();
  }

  async some(predicate: (value: T, index?: number) => boolean): Promise<boolean> {
    let index = 0;
    for await (const value of this) {
      if (predicate(value, index)) return true;
      index++;
    }
    return false;
  }

  async every(predicate: (value: T, index?: number) => boolean): Promise<boolean> {
    let index = 0;
    for await (const value of this) {
      if (!predicate(value, index)) return false;
      index++;
    }
    return true;
  }

  async none(predicate: (value: T, index?: number) => boolean): Promise<boolean> {
    return this.some(predicate).then((result) => !result);
  }

  async forEach(consumer: (value: T, index?: number) => void): Promise<void> {
    let index = 0;
    for await (const value of this) {
      consumer(value, index);
      index++;
    }
  }

  async count(): Promise<number> {
    let count = 0;
    for await (const _ of this) {
      count++;
    }
    return count;
  }

  join(): Promise<string>;
  join(delimiter: string): Promise<string>;
  join(delimeter: string, prefix: string, suffix: string): Promise<string>;
  join(delimeter?: string, prefix?: string, suffix?: string): Promise<string> {
    return this.toArray().then(
      (array) => `${prefix ?? ''}${array.join(delimeter)}${suffix ?? ''}`,
    );
  }

  async into(set: Set<T>): Promise<Set<T>>;
  async into(array: Array<T>): Promise<Array<T>>;
  async into(array: T[]): Promise<T[]>;
  async into(setOrArray: Set<T> | Array<T> | T[]) {
    for await (const value of this) {
      if (setOrArray instanceof Set) {
        setOrArray.add(value);
      } else {
        setOrArray.push(value);
      }
    }
    return setOrArray;
  }

  async reduce<U>(
    reducer: (accumulator: U, value: T, index?: number) => U,
    initialValue: U,
  ): Promise<U> {
    let index = 0;
    let accumulator = initialValue;
    for await(const value of this) {
      accumulator = reducer(accumulator, value, index);
      index++;
    }
    return accumulator;
  }

  async toArray(): Promise<T[]> {
    const array: T[] = [];
    for await (const value of this) {
      array.push(value);
    }
    return array;
  }

  async toSet(): Promise<Set<T>> {
    const set = new Set<T>();
    for await (const value of this) {
      set.add(value);
    }
    return set;
  }

  async toMap<K, V>(keyExtractor: (value: T) => K, valueExtractor: (value: T) => V): Promise<Map<K, V>> {
    return this.reduce((acc, value) => acc.set(keyExtractor(value), valueExtractor(value)), new Map<K, V>());
  }

  async toJsonString(): Promise<string> {
    return this.toArray().then((array) => JSON.stringify(array));
  }
}
