# fluent-ffmpeg test suite

## Organization of tests

### Unit tests

Tests under `tests/unit/**` are unit tests for components. Unit tests only test the own features of a module. **All dependencies are mocked**, and unit tests check that we use them properly and use their output properly.

There should be one unit test file per source file (except when the source only exports constant literals/regexps), and the test file for `src/path/to/module.ts` should be `tests/unit/path/to/module-test.ts`.

All unit tests that use `sinon` mocks should be marked as serial (`test.serial(...)`) so that other tests that use the mocked object don't run in parallel.

In CI, unit tests are only run once, on the latest supported Node version and on Linux.

### Integration tests

Tests under `tests/integration/**` are integration tests. They check integration of all fluent-ffmpeg components together. **External dependencies are mocked**, but not internal ones.

All unit tests that use `sinon` mocks should be marked as serial (`test.serial(...)`) so that other tests that use the mocked object don't run in parallel.

In CI, integration tests are run on all supported Node versions but only on Linux.

### Acceptance tests

Tests under `tests/acceptance/**` are acceptance tests. They run user-like scenarios and do not mock any external dependencies; for example they actually run ffmpeg. They are not intended to thoroughly test all features, but they should test the most common scenarios. They can also be used to test for a bugfix.

Acceptance tests should not import submodules, only `main.ts`.

In CI, acceptance tests are run in a matrix with all supported OSes and Node versions.
