---
name: unit-test-writer
description: 'Automated unit test writer with mutation testing feedback loop. Use when writing unit tests, improving test coverage, running mutation tests with PIT, checking mutation score, or validating test quality. Targets 80% code coverage and 80% mutation score through an iterative write-test-mutate loop (max 3 iterations).'
argument-hint: 'Optional: specify a class or package to target (e.g. "SwapperController")'
---

# Unit Test Writer

## Purpose

Write unit tests that achieve ≥80% code coverage, then validate their quality via PIT mutation testing. Iterates up to three times to reach a mutation score ≥80%.

---

## Loop Procedure

Maintain an internal **iteration counter** starting at 1. Execute the following steps each iteration.

### Step 1 — Write / Improve Unit Tests

- Identify all non-trivial classes in `src/main/java/` (skip `*Application.java` bootstrap classes).
- For each target class, write JUnit 5 tests in `src/test/java/` mirroring the production package structure.
- Aim for **≥80% line/branch coverage**:
  - Every public method needs at least one happy-path test.
  - Add negative/edge-case tests for conditional logic (`if`, `switch`, ternaries, null checks).
  - Use `@WebMvcTest` + `MockMvc` for controllers, `@DataJpaTest` for repositories, plain JUnit for model/utility classes.
- When mocking Spring beans, use `@MockitoBean` (Spring Boot 3.4+), not the deprecated `@MockBean`.

**Controller test pattern:**
```java
@WebMvcTest(SwapperController.class)
class SwapperControllerTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean SwapperRepository swapperRepository;

    @Test
    void getById_notFound_returns404() throws Exception {
        given(swapperRepository.findById("ghost")).willReturn(Optional.empty());
        mockMvc.perform(get("/api/swappers/ghost"))
               .andExpect(status().isNotFound());
    }
}
```

**Repository test pattern:**
```java
@DataJpaTest
class ItemRepositoryTest {
    @Autowired ItemRepository itemRepository;
    @Autowired SwapperRepository swapperRepository;

    @Test
    void findByType_returnsMatchingItems() {
        // arrange → act → assert
    }
}
```

### Step 2 — Run Newly Created Tests and Fix Failures

Run **only** the test classes written or modified in Step 1 (do not run the full suite yet). Use `-Dtest=` to target them by class name:

```bash
./mvnw test -Dtest=SwapperControllerTest,ItemControllerTest,SwapperRepositoryTest,ItemRepositoryTest
```

Adjust the `-Dtest=` list to match whichever classes were just created or changed.

For each failure:
1. Read the assertion error carefully — distinguish between a **test bug** (wrong expectation, missing mock setup) and a **production bug** (logic error in the class under test).
2. Fix the root cause. If the production code is wrong, fix it; if the test expectation is wrong, correct the assertion.
3. Re-run the same targeted command until all newly written tests pass before moving on.

Do not proceed to Step 3 with failing tests.

### Step 3 — Run Full Test Suite and Check Coverage

Run the full test suite to confirm nothing was broken by the new tests or any production code fixes made in Step 2:

```bash
./mvnw test
```

Review the output for any failures in pre-existing tests. If regressions are found, fix them before proceeding. Do not move on to mutation testing with a failing suite.

### Step 4 — Run Mutation Tests

```bash
./mvnw org.pitest:pitest-maven:mutationCoverage
```

PIT will output a summary line similar to:
```
>> Generated 42 mutations Killed 34 (81%)
```

Find the HTML report at: `target/pit-reports/<timestamp>/index.html`

### Step 5 — Read and Evaluate the Mutation Score

Parse the mutation score percentage from the PIT output.

| Condition | Action |
|-----------|--------|
| Score **≥ 80%** | **Done.** Report score and surviving mutant details to the user. |
| Score **< 80%** AND iteration **< 3** | Increment counter. Go to **Step 6**, then loop back to **Step 1**. |
| Score **< 80%** AND iteration **≥ 3** | **Escalate.** Stop and report the problem (see "Escalation" below). |

### Step 6 — Analyze Surviving Mutants (before next iteration)

Read the PIT HTML/XML report to identify which mutants survived. Common survivors and fixes:

| Surviving mutant type | Likely missing test |
|-----------------------|---------------------|
| Conditional boundary (`>` → `>=`) | Add boundary-value assertions |
| Negated conditional | Test both true and false branches |
| Void method call removed | Assert side-effects (saved entity, response body) |
| Return value changed | Assert on specific return values, not just status codes |
| Null return | Test null-input handling |

Use these findings to guide the next round of test improvements in Step 1.

---

## Escalation Message

If the loop has run 3 times without reaching 80%, report the following to the user:

> "After 3 iterations the mutation score is still below 80% (current score: X%). Manual investigation is required. Surviving mutants are concentrated in: [list of classes/methods]. Recommended next steps: [specific suggestions based on survivors]."

---

## Project-Specific Notes (toySwap)

- **Framework**: Spring Boot 4.x, JUnit 5, H2 in-memory DB
- **PIT plugin**: already configured in `pom.xml`; targets `com.example.toyswap.*`
- **Excluded from mutation**: `ToyswapApplication` (bootstrap only)
- **Date format**: `MM/dd/yyyy` — test both valid and boundary dates
- **Password field**: marked `@JsonProperty(access = WRITE_ONLY)` — assert it never appears in GET responses
- **Item → Swapper FK**: `currentOwner` — test create/update flows with valid and missing owner IDs

---

## Completion Report Format

When done (score met or escalated), report:

```
Iteration:        X of 3
Mutation score:   XX%
Tests written:    N new tests across M classes
Surviving mutants: [list or "none"]
Status:           PASSED / ESCALATED
```
