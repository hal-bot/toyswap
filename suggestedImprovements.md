# Suggested Improvements

These are non-bug improvements identified during code review. None are blocking, but each improves security, maintainability, or correctness.

---

## Security

### 1. No input validation on any endpoint
Controllers accept any payload without validation. A request with a blank `name`, a 10,000-character string, or a null `type` goes straight to the database.

**Recommendation:**
- Add `spring-boot-starter-validation` to `backend/pom.xml`
- Annotate model fields with `@NotBlank`, `@Size`, `@Pattern` etc.
- Add `@Valid` to all `@RequestBody` parameters

### 2. H2 console has no profile guard
`spring.h2.console.enabled=true` is unconditional in `application.properties`. If this config accidentally reaches a deployed environment, anyone can read and modify the database.

**Recommendation:** Either disable it via `spring.h2.console.enabled=false` in a separate `application-prod.properties` profile, or wrap the property with:
```properties
# application.properties (dev only)
spring.h2.console.enabled=true
```
plus a `application-prod.properties` that sets it to `false`.

### 3. `GET /api/swappers` exposes all users
`SwapperController.getAllSwappers()` returns every registered user without authentication or pagination. This leaks usernames, names, and zip codes.

**Recommendation:** Either remove the endpoint, restrict it to admins, or add pagination (`Pageable`).

### 4. No CORS configuration
The backend has no explicit CORS headers. The Vite dev proxy hides this locally, but deployed environments (or any consumer not behind the same origin) will get CORS errors.

**Recommendation:** Add a `@Configuration` class with a `CorsConfigurationSource` bean, or use `@CrossOrigin` on controllers, scoped to known origins.

---

## Code Quality

### 5. Raw `Map` request bodies instead of DTOs
`SwapController` takes `Map<String, Long>` and `SwapperController.login()` takes `Map<String, String>`. These are untyped, hard to validate, and invisible in generated API docs.

**Recommendation:** Create simple record DTOs:
```java
public record SwapRequest(Long offerItemId, Long requestItemId) {}
public record LoginRequest(String username, String password) {}
```

### 6. Reflection-based SNS publishing
`SwapEventPublisher.publishToSns()` calls the AWS SDK via reflection to keep the `sns` dependency optional. But the SDK is already declared in `pom.xml` (as `<optional>true</optional>`), so reflection buys nothing and loses compile-time safety.

**Recommendation:** Inject an `SnsClient` bean guarded by `@ConditionalOnProperty(name = "toyswap.sns.topicArn")` or `@Profile("aws")`. Call the SDK directly.

### 7. String-typed enum fields in `Item`
`type`, `condition`, and `ageLevel` are plain `String` fields with enum values listed only in comments. Invalid strings are accepted and stored silently.

**Recommendation:** Convert to Java enums (`ItemType`, `ItemCondition`, `AgeLevel`), or add `@Pattern` constraints if you prefer to keep them as strings. The frontend types already define these enums correctly.

### 8. `estimatedValue` uses `float`
Floating-point arithmetic is lossy for decimal values (`0.1 + 0.2 != 0.3`). Money or value fields should use `BigDecimal`.

**Recommendation:**
```java
@Column(name = "estimated_value")
private BigDecimal estimatedValue;
```

### 9. Misleading comment in `backend/pom.xml`
The PIT plugin comment says `"Required for JUnit 6 support"` and `"project uses JUnit Platform 6.x"`. The project uses JUnit 5 (Jupiter); the JUnit *Platform* is a separate versioning axis.

**Recommendation:** Change the comment to `"Required for JUnit 5 (Jupiter) support"`.

---

## Documentation

### 10. OpenAPI spec is missing two core endpoints
`contracts/openapi.yaml` has no entry for:
- `POST /api/swaps` — the swap operation
- `POST /api/swappers/login` — authentication

**Recommendation:** Add both paths with request/response schemas. The `SwapRequest` / `SwapResponse` schemas can reference the existing `Item` schema.

### 11. OpenAPI `currentOwner` schema is wrong
The spec defines `currentOwner` as `$ref: '#/components/schemas/Swapper'` (a full object). The actual JSON response returns a plain string (the user's `userId`).

**Recommendation:** Change the `Item` schema's `currentOwner` property to `type: string`.

### 12. README missing `DELETE /api/swappers/{userId}`
The API Reference table for Swappers omits the DELETE endpoint that exists in the controller.

**Recommendation:** Add `DELETE /api/swappers/{userId}` to the table.

### 13. `estimatedValue` and `whenPurchased` are dead fields
Both fields exist in the backend `Item` model, the OpenAPI spec, and the `seed.mjs` script, but are never set or displayed by the frontend. They accumulate confusion without providing user value.

**Recommendation:** Either wire them into the AddItemPage form and ItemCard display, or remove them from the model, spec, and seed script.

### 14. `@types/react-router-dom` in wrong dependency section
`package.json` lists `@types/react-router-dom` (a type-only package) under `dependencies` instead of `devDependencies`. This is also the v5 types while the project uses v7.

**Recommendation:** Move it to `devDependencies`, or remove it entirely since `react-router-dom` v7 ships its own types.
