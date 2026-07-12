FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

# Install system dependencies required for compiling some packages (like jq)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libjq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all files from backend directory to the container
COPY . .

# Expose port (Cloud Run sets the PORT env variable automatically and expects the server to listen on it)
EXPOSE 8080

# Run the FastAPI server with uvicorn
CMD exec uvicorn server:app --host 0.0.0.0 --port $PORT
