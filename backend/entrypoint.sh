#!/bin/bash
set -e

echo "=================================================="
echo " Starting Habition Microservices Stack (Render)   "
echo "=================================================="

# Ultra-lean memory settings for free tier (512MB RAM constraint)
# -Xss256k cuts thread stack memory from 1MB down to 256KB (saves ~90MB total across 6 services)
JVM_COMMON="-XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:MaxMetaspaceSize=64m -Xss256k"
SVC_JVM_OPTS="-Xms32m -Xmx64m $JVM_COMMON"
GATEWAY_JVM_OPTS="-Xms48m -Xmx96m $JVM_COMMON"

# Ensure PORT is defined (Render passes PORT dynamically)
export PORT=${PORT:-8080}
export EUREKA_PORT=8761
export EUREKA_URL="http://localhost:8761/eureka/"

echo "1/6 Starting Eureka Server (port 8761)..."
java $SVC_JVM_OPTS -jar /app/EurekaServer.jar &
EUREKA_PID=$!

echo "Waiting for Eureka Server to become available..."
for i in {1..30}; do
  if curl -s http://localhost:8761/actuator/health >/dev/null 2>&1 || curl -s http://localhost:8761/eureka/apps >/dev/null 2>&1; then
    echo "Eureka Server is UP!"
    break
  fi
  sleep 1
done

echo "2/6 Starting Auth Service (port 8081)..."
java $SVC_JVM_OPTS -jar /app/AuthService.jar &
AUTH_PID=$!

echo "3/6 Starting Group Service (port 8082)..."
java $SVC_JVM_OPTS -jar /app/GroupService.jar &
GROUP_PID=$!

echo "4/6 Starting Habit Service (port 8083)..."
java $SVC_JVM_OPTS -jar /app/HabitService.jar &
HABIT_PID=$!

echo "5/6 Starting Notification Service (port 8084)..."
java $SVC_JVM_OPTS -jar /app/NotificationService.jar &
NOTIF_PID=$!

# Handle graceful shutdown
shutdown() {
  echo "Received shutdown signal. Stopping all services..."
  kill -TERM $EUREKA_PID $AUTH_PID $GROUP_PID $HABIT_PID $NOTIF_PID 2>/dev/null || true
  wait $EUREKA_PID $AUTH_PID $GROUP_PID $HABIT_PID $NOTIF_PID 2>/dev/null || true
  exit 0
}
trap shutdown SIGINT SIGTERM EXIT

echo "6/6 Starting API Gateway on public port $PORT..."
# ApiGateway runs in foreground to keep container running and bind to public Render port
java $GATEWAY_JVM_OPTS -Dserver.port=$PORT -jar /app/ApiGateway.jar
