# Run Tests

Run the test suite for nuxt-upload-kit.

## Instructions

1. Run the appropriate test command based on what the user needs:

   ```bash
   # Run all tests once
   pnpm test

   # Run tests in watch mode (for development)
   pnpm test:watch

   # Run tests with coverage report
   pnpm test:coverage

   # Type-check only
   pnpm test:types
   ```

2. If tests fail:
   - Read the error output carefully
   - Identify which test file and test case failed
   - Look at the relevant source code
   - Fix the issue and re-run tests

3. If the user wants to run a specific test file:
   ```bash
   pnpm vitest run path/to/test.spec.ts
   ```

4. If adding new tests, place them alongside the source file or in a `tests/` directory with `.spec.ts` or `.test.ts` extension
