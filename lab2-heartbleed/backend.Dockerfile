# Build + run backend Spring Boot thật của nhóm (context = thư mục gốc project Maven)
# Dùng chung pattern với managedocuments/managedocuments/lab-cve-2023-25690/backend.Dockerfile
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -e -B dependency:go-offline || true
COPY src ./src
RUN mvn -q -e -B clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
