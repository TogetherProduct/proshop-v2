#!/bin/bash

# Quick Setup Script for Recommendation Engine
# ============================================

echo "🚀 Setting up Recommendation Engine (Batch Processing)"
echo ""

# Check if Redis is running
check_redis() {
  if ! command -v redis-cli &> /dev/null; then
    echo "❌ Redis CLI not found"
    echo "   Install Redis first:"
    echo "   - macOS: brew install redis"
    echo "   - Ubuntu: sudo apt-get install redis-server"
    echo "   - Docker: docker run -d -p 6379:6379 redis:latest"
    return 1
  fi

  if ! redis-cli ping &> /dev/null; then
    echo "⚠️  Redis not connected"
    echo "   Start Redis server first:"
    echo "   - macOS: brew services start redis"
    echo "   - Ubuntu: sudo systemctl start redis-server"
    echo "   - Docker: docker start <container_id>"
    return 1
  fi

  echo "✅ Redis is running"
  return 0
}

# Check if Python venv exists
check_python_env() {
  if [ ! -d "integration/item-recommendation/.venv" ]; then
    echo "⚠️  Python venv not found"
    echo "   Create it with:"
    echo "   cd integration/item-recommendation"
    echo "   python3 -m venv .venv"
    echo "   source .venv/bin/activate"
    echo "   pip install -r requirements.txt"
    return 1
  fi

  echo "✅ Python venv exists"
  return 0
}

# Check if trained models exist
check_models() {
  if [ ! -d "integration/item-recommendation/models/trained_models" ]; then
    echo "⚠️  Trained models not found"
    echo "   Run: cd integration/item-recommendation && python main.py train"
    return 1
  fi

  echo "✅ Trained models found"
  return 0
}

# Setup
echo "📦 Checking dependencies..."
check_redis
REDIS_OK=$?

check_python_env
PYTHON_OK=$?

check_models
MODELS_OK=$?

echo ""
echo "📋 Configuration:"
echo "   - Edit .env for Redis settings"
echo "   - BATCH_CRON_SCHEDULE: When to run batch (default: 0 2 * * * = 2 AM)"
echo "   - BATCH_SIZE: Number of products per batch (default: 50)"
echo ""

if [ $REDIS_OK -eq 0 ] && [ $PYTHON_OK -eq 0 ] && [ $MODELS_OK -eq 0 ]; then
  echo "✅ All checks passed! Ready to start:"
  echo "   npm run server"
  echo ""
  echo "📖 Documentation: RECOMMENDATION_ARCHITECTURE.md"
else
  echo "❌ Some dependencies missing. See above for instructions."
fi
