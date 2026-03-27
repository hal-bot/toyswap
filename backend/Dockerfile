# Stage 1: Build (only if JAR not already provided by CI)
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
# Copy root parent POM so Maven can resolve it via relativePath (../pom.xml)
COPY pom.xml /pom.xml
COPY backend/mvnw backend/pom.xml ./
COPY backend/.mvn .mvn
COPY backend/src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B package -DskipTests -q

# Stage 2: Runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/items || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
