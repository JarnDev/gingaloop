# Level rubric (language-agnostic)

Levels are earned per language, from 1 to 10. Write to the level you are given: not easier, not
harder. Each level must feel clearly harder than the one before it. "Minutes" is the time a
competent learner AT that level needs.

## Level 1
Fundamentals: 15–20 minutes.
- One function, one clear idea: loops, conditionals, strings, basic collections.
- Small, well-formed inputs; only the obvious edge cases (empty input, single element).
- The idiomatic standard-library way exists and is worth learning.
- Examples: run-length encoding, chunking an array, counting words.

## Level 2
Basics with real edge cases: 20–30 minutes.
- Still one or two functions, but the edge cases need thought: duplicates, boundaries, unicode,
  integer overflow, empty vs missing, off-by-one ranges.
- Input validation with precise errors is part of the contract.
- Examples: parsing page ranges like "1-3,5", a bracket matcher with error positions, title-casing
  with exceptions.

## Level 3
A small data structure plus an algorithm: 30–40 minutes.
- Two or three interacting ideas, e.g. a ring buffer, a merge of sorted inputs, a sliding window.
- Complexity starts to matter; a perf test enforces the expected class (O(n) or O(n log n)).
- Examples: ring buffer, top-k with a heap, interval merging, two-pointer problems.

## Level 4
A design decision and stateful API: 35–50 minutes.
- The learner chooses the data structure and keeps invariants across calls.
- The public API has state (a class/struct/module with several operations).
- Examples: LRU cache, rate limiter with an injected clock, undo/redo stack, simple tokenizer.

## Level 5
Language depth: 45–60 minutes.
- The challenge is ABOUT the language's distinctive mechanics, not only the algorithm:
  memory ownership and lifetimes in C, RAII/move semantics in C++, generics and narrowing in TS,
  Promise/microtask ordering in JS, streams and events in Node, iterators/generators/context managers
  in Python, borrowing in Rust, etc.
- Tests probe the mechanic directly (leaks under sanitizers, type errors, ordering of events).
- Examples: a generic typed event emitter, a dynamic array with a growth strategy, an async queue
  with a concurrency limit.

## Level 6
Several components with invariants and error contracts: 50–75 minutes.
- Two or three cooperating parts (parser + evaluator, index + query, store + cache).
- Errors are part of the contract: what fails, how it is reported, and what state remains.
- Examples: an expression evaluator with precise errors, an in-memory key-value store with TTL and
  snapshots, a dependency resolver that detects cycles.

## Level 7
Advanced: 60–90 minutes.
- Concurrency/async correctness, streaming with backpressure, custom allocators, generic containers,
  or a performance budget that rules out the naive approach.
- Adapting a known algorithm (not just recalling it) is required.
- Examples: interval tree queries, an async semaphore with cancellation, an arena allocator,
  a Transform stream with backpressure, Dijkstra on an implicit graph.

## Level 8
Mini-systems: 75–120 minutes.
- A realistic small system with a clear spec: a tiny interpreter, a job scheduler with priorities
  and retries, a binary protocol codec, a text diff, a regex subset matcher.
- The tests cover the spec broadly plus a few nasty cases.

## Level 9
Expert: 90–150 minutes.
- Mini-systems where the difficulty is in subtle failure modes: reentrancy, ordering under
  concurrency, overflow, resource leaks on error paths, exception safety, memory-model issues.
- The explanation must discuss trade-offs a senior engineer would weigh.
- Examples: a persistent (immutable) map with structural sharing, a lock-free single-producer
  single-consumer queue, a write-ahead log with crash-recovery tests.

## Level 10
Mastery: 2–4 hours, may span several sessions.
- Research-grade mini-projects with a precise spec and a deep test suite: a CRDT that converges
  under any operation order, a mark-and-sweep garbage collector for a toy heap, an incremental
  parser, a B-tree with deletion, a small type checker.
- Correctness under adversarial tests (randomized with fixed seeds, property-style checks) is the bar.
- The explanation covers the design space and the literature the learner should read next.
