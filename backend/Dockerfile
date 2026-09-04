# Multi-stage Dockerfile for Habition Microservices on Render Free Tier

# Stage 1: Build JARs
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder
WORKDIR /build

# Copy all microservice source directories
COPY EurekaServer ./EurekaServer
COPY ApiGateway ./ApiGateway
COPY AuthService ./AuthService
COPY GroupService ./GroupService
COPY HabitService ./HabitService
COPY NotificationService ./NotificationService

# Compile and package all 6 services
RUN cd EurekaServer && mvn clean package -DskipTests && \
    cd ../ApiGateway && mvn clean package -DskipTests && \
    cd ../AuthService && mvn clean package -DskipTests && \
    cd ../GroupService && mvn clean package -DskipTests && \
    cd ../HabitService && mvn clean package -DskipTests && \
    cd ../NotificationService && mvn clean package -DskipTests

# Stage 2: Ultra-lean Runtime Container
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Install bash and curl for service health orchestration
RUN apk add --no-cache bash curl

# Copy packaged JARs from builder stage
COPY --from=builder /build/EurekaServer/target/EurekaServer-0.0.1-SNAPSHOT.jar /app/EurekaServer.jar
COPY --from=builder /build/ApiGateway/target/ApiGateway-0.0.1-SNAPSHOT.jar /app/ApiGateway.jar
COPY --from=builder /build/AuthService/target/AuthService-0.0.1-SNAPSHOT.jar /app/AuthService.jar
COPY --from=builder /build/GroupService/target/GroupService-0.0.1-SNAPSHOT.jar /app/GroupService.jar
COPY --from=builder /build/HabitService/target/HabitService-0.0.1-SNAPSHOT.jar /app/HabitService.jar
COPY --from=builder /build/NotificationService/target/NotificationService-0.0.1-SNAPSHOT.jar /app/NotificationService.jar

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Default port exposed to Render
EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
