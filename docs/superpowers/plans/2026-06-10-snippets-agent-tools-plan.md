# Snippets Agent Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a robust and secure suite of Agent tools (Query, Add, Update, Delete, and Batch variants) for managing snippets in the local SQLite database, following the architecture of `todoTool.ts` and `peopleTool.ts`.

**Architecture:** 
1. Service Layer Extension: Add `querySql` to `SnippetsService` in `snippetsService.ts` for read-only SQL queries.
2. Tool Layer creation: Create `snippetTool.ts` containing the tool schemas, validation, SQL filtering (single table constraints, keyword checks, single SELECT queries), and UX confirmation bubble specifications.
3. Registration Layer integration: Incorporate the service and tools into `toolRegistry.ts` and `aiHandlers.ts`.

**Tech Stack:** TypeScript, SQLite (better-sqlite3 via custom wrapper), Drizzle ORM, Vitest for unit testing.

---

### Task 1: Extend SnippetsService with querySql

**Files:**
- Modify: `src/main/services/snippetsService.ts`
- Modify: `test/main/services/snippetsService.test.ts`

- [ ] **Step 1: Write a failing test for `querySql` in `snippetsService.test.ts`**
  Add a test verifying that `querySql` executes a raw SELECT query and returns the results.
  ```typescript
  test('querySql should execute raw sql select query', () => {
    const service = createSnippetsService(mockDb)
    mockDb.prepare.mockImplementation(() => ({
      all: () => [{ id: 1, title: 'Test' }]
    }))
    const result = service.querySql('SELECT * FROM snippets')
    expect(result).toEqual([{ id: 1, title: 'Test' }])
    expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM snippets')
  })
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm run test test/main/services/snippetsService.test.ts` (or appropriate vitest command)
  Expected: FAIL with "Property 'querySql' does not exist on type 'SnippetsService'"

- [ ] **Step 3: Update `SnippetsService` type definition**
  Add `querySql: (sql: string) => unknown[]` to the `SnippetsService` type in `src/main/services/snippetsService.ts`.

- [ ] **Step 4: Implement `querySql` in `createSnippetsService`**
  Add the following implementation:
  ```typescript
  querySql: (sql) => {
    return database.prepare(sql).all()
  }
  ```

- [ ] **Step 5: Run tests and make sure they pass**
  Run: `npm run test test/main/services/snippetsService.test.ts`
  Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git add src/main/services/snippetsService.ts test/main/services/snippetsService.test.ts
  git commit -m "feat(snippets): add querySql to SnippetsService"
  ```

---

### Task 2: Create snippetTool.ts and Implement snippets_tool_query

**Files:**
- Create: `src/main/agent/tools/snippetTool.ts`
- Create: `test/main/agent/tools/snippetTool.test.ts`

- [ ] **Step 1: Design and Write `snippets_tool_query`**
  Implement the SQL validation helper, structured condition parsing, structured WHERE builder, structured SQL compiler, and the tool config in `src/main/agent/tools/snippetTool.ts`.
  It must check:
  - Max SQL length = 1200.
  - Multi-statements or comments forbidden.
  - SELECT only.
  - No forbidden keywords (`insert`, `update`, `delete`, `drop`, `alter`, `create`, `attach`, `detach`, `pragma`, `vacuum`, `replace`, `reindex`, `begin`, `commit`, `rollback`, `union`, `join`).
  - Table name must be only `snippets`.
  - Default `limit = 20`, max `limit = 50`.

- [ ] **Step 2: Write tests for `snippets_tool_query` in `snippetTool.test.ts`**
  Add test cases verifying:
  - Correct execution of queries with structured inputs (query, conditions, limit).
  - Proper compilation of WHERE clauses.
  - Rejection of invalid or forbidden SQL (JOINs, UNIONs, modifications, comments).

- [ ] **Step 3: Run the new test suite**
  Run: `npx vitest run test/main/agent/tools/snippetTool.test.ts`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add src/main/agent/tools/snippetTool.ts test/main/agent/tools/snippetTool.test.ts
  git commit -m "feat(agent): implement snippet_tool_query and its safety guardrails"
  ```

---

### Task 3: Implement Mutation Tools (Add, Update, Delete)

**Files:**
- Modify: `src/main/agent/tools/snippetTool.ts`
- Modify: `test/main/agent/tools/snippetTool.test.ts`

- [ ] **Step 1: Implement `snippets_tool_add`, `snippets_tool_update`, `snippets_tool_delete`**
  Implement the three tools, including parameters schema, executable executors, and respective confirmation templates:
  - `SNIPPET_ADD_CONFIRMATION`
  - `SNIPPET_UPDATE_CONFIRMATION`
  - `SNIPPET_DELETE_CONFIRMATION`
  Ensure parameters require necessary fields, validate parameters strictly, and support `confirmationSummary`.

- [ ] **Step 2: Write tests for single mutations**
  Add test cases to `snippetTool.test.ts` that execute the mutation tools, testing valid/invalid inputs, mock success values, and checking that the returned `confirmation` config renders targets/summaries/completion messages exactly.

- [ ] **Step 3: Run tests and ensure they pass**
  Run: `npx vitest run test/main/agent/tools/snippetTool.test.ts`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add src/main/agent/tools/snippetTool.ts test/main/agent/tools/snippetTool.test.ts
  git commit -m "feat(agent): implement single mutation snippet tools (add, update, delete)"
  ```

---

### Task 4: Implement Batch Tools (Batch Add, Batch Update, Batch Delete)

**Files:**
- Modify: `src/main/agent/tools/snippetTool.ts`
- Modify: `test/main/agent/tools/snippetTool.test.ts`

- [ ] **Step 1: Implement `snippets_tool_batch_add`, `snippets_tool_batch_update`, `snippets_tool_batch_delete`**
  Implement batch tools in `snippetTool.ts` following the batch pattern of `todoTool.ts`. Include:
  - Batch confirmation configs (`SNIPPET_BATCH_ADD_CONFIRMATION`, `SNIPPET_BATCH_UPDATE_CONFIRMATION`, `SNIPPET_BATCH_DELETE_CONFIRMATION`).
  - Validation schemas requiring `items` and `confirmationSummary` (or `ids` for deletion).
  - Execute functions that loop and call the respective `snippetsService` methods sequentially.

- [ ] **Step 2: Write tests for batch mutations**
  Verify batch creations, updates, and deletions, checking correct rendering of batch confirmation details (count, target preview items) and proper batch completions.

- [ ] **Step 3: Run Vitest tests**
  Run: `npx vitest run test/main/agent/tools/snippetTool.test.ts`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add src/main/agent/tools/snippetTool.ts test/main/agent/tools/snippetTool.test.ts
  git commit -m "feat(agent): implement batch snippet tools (batch_add, batch_update, batch_delete)"
  ```

---

### Task 5: Register Snippets Tools & Integrate Services

**Files:**
- Modify: `src/main/agent/tools/toolRegistry.ts`
- Modify: `src/main/ipc/aiHandlers.ts`

- [ ] **Step 1: Integrate snippets in `toolRegistry.ts`**
  - Add `snippetsService: Pick<SnippetsService, 'querySql' | 'create' | 'update' | 'delete'>` to `AgentToolRegistryContext`.
  - In `builtinToolFactories`, register:
    ```typescript
    ({ snippetsService }) => createSnippetTools(snippetsService)
    ```

- [ ] **Step 2: Inject `snippetsService` in `aiHandlers.ts`**
  - Import `createSnippetsService` and `type DatabaseConnection as SnippetsDatabaseConnection` from `@/services/snippetsService`.
  - Initialize:
    ```typescript
    const snippetsService = createSnippetsService(database as unknown as SnippetsDatabaseConnection)
    ```
  - Pass `snippetsService` to `createAgentToolRegistry` alongside `peopleService` and `todosService`.

- [ ] **Step 3: Verify the entire codebase compiles and passes typecheck**
  Run: `npm run typecheck` or similar workspace validation command.
  Expected: Zero compilation errors.

- [ ] **Step 4: Run all unit tests**
  Run: `npm test` or `npx vitest run`
  Expected: All tests PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/main/agent/tools/toolRegistry.ts src/main/ipc/aiHandlers.ts
  git commit -m "feat(agent): register snippet tools and integrate snippets service into agent context"
  ```
