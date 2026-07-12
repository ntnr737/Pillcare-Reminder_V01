import httpx
import logging
import asyncio
from google.antigravity.triggers import TriggerContext

# Set up logging
logging.basicConfig(level=logging.INFO)

# The local or staging health endpoint of the backend API
BACKEND_HEALTH_URL = "http://localhost:8080/api/health"

async def check_api_health(ctx: TriggerContext):
    """Periodically pings the FastAPI backend health endpoint to check for failures.
    
    If the server returns an error, or crashes, we notify the Chief of Engineering Agent.
    """
    logging.info("Checking API health...")
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(BACKEND_HEALTH_URL)
            if response.status_code != 200:
                # Backend is unhealthy! Send an alert to the agent conversation
                logging.error(f"API Health Check Failed! Status Code: {response.status_code}")
                await ctx.send(
                    f"CRITICAL ALERT: The API server at {BACKEND_HEALTH_URL} returned status code {response.status_code}. "
                    "Please read the application logs, find the traceback/bug, run tests, and fix it."
                )
    except httpx.RequestError as e:
        # Backend is completely down / unreachable
        logging.error(f"API Health Check Failed! Request Error: {str(e)}")
        await ctx.send(
            f"CRITICAL ALERT: The API server at {BACKEND_HEALTH_URL} is completely offline/unreachable. "
            "Please check the log files, look for startup crashes, and verify if the database connection is broken."
        )

async def check_log_errors(ctx: TriggerContext):
    """Scans the backend application logs for any Exceptions or Tracebacks.
    
    If an exception is found, it sends the stack trace to the Chief of Engineering Agent.
    """
    import os
    log_file = "/tmp/pillcare_backend.log"
    
    # We maintain the last read position to only read new logs
    state = ctx.get_state("log_position", 0)
    
    if not os.path.exists(log_file):
        return

    try:
        file_size = os.path.getsize(log_file)
        if file_size < state:
            # Log file was rotated or cleared
            state = 0
            
        with open(log_file, "r") as f:
            f.seek(state)
            new_lines = f.read()
            ctx.set_state("log_position", f.tell())
            
        if "Traceback" in new_lines or "ERROR" in new_lines:
            # We found a crash trace
            await ctx.send(
                f"ALERT: Detected exceptions/errors in the logs:\n\n{new_lines[-500:]}\n\n"
                "Please analyze this log slice, find the buggy code, edit the source file to fix it, and run tests."
            )
    except Exception as e:
        logging.error(f"Error checking log files: {str(e)}")
