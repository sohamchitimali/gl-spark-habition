#!/bin/bash

echo "======================================"
echo " Habition Microservices Launcher"
echo "======================================"

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Trap SIGINT (Ctrl+C) and terminate all background jobs
trap 'echo "Terminating all services..."; kill $(jobs -p)' EXIT

echo "Starting Eureka Server..."
(cd EurekaServer && ./mvnw spring-boot:run) &
sleep 10

echo "Starting API Gateway..."
(cd ApiGateway && ./mvnw spring-boot:run) &
sleep 5

echo "Starting Auth Service..."
(cd AuthService && ./mvnw spring-boot:run) &
sleep 5

echo "Starting Group Service..."
(cd GroupService && ./mvnw spring-boot:run) &
sleep 5

echo "Starting Habit Service..."
(cd HabitService && ./mvnw spring-boot:run) &
sleep 5

echo "Starting Notification Service..."
(cd NotificationService && ./mvnw spring-boot:run) &

echo "======================================"
echo "All services launched in background."
echo "Logs are streaming to this console."
echo "Press Ctrl+C to terminate all services."
echo "======================================"

# Wait for all background processes
wait
