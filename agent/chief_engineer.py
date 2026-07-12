import asyncio
import logging
import os
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.triggers import every
from tools import read_application_logs, run_test_suite, modify_source_file, trigger_gcp_redeploy
from monitor import check_api_health, check_log_errors

# Set up logging for the agent process
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

# 1. System instructions defining the persona of the Chief of Engineering Agent
SYSTEM_INSTRUCTIONS = """
You are the Chief of Engineering Agent for the Pillcare Reminder application.
Your mission is to keep the application stable, error-free, and online.

When a trigger alert notifies you of an issue (e.g. backend down, tracebacks in logs):
1. Immediately run 'read_application_logs' to see what went wrong.
2. Formulate a hypothesis and find the file causing the error.
3. Use 'modify_source_file' to apply a code fix.
4. Run 'run_test_suite' to make sure the tests pass.
5. If the tests pass and the issue is resolved, run 'trigger_gcp_redeploy' to deploy the fix to production.
6. Verify the fix in logs or run another check.

Act autonomously and quickly. Keep communication clean.
"""

async def main():
    # Verify Gemini API key is available
    if not os.environ.get("GEMINI_API_KEY"):
        logging.warning(
            "GEMINI_API_KEY is not set. Please set it in your environment or .env file."
        )

    # 2. Configure triggers (every 30 seconds for health check, every 15 seconds for log errors)
    health_trigger = every(30, check_api_health)
    log_trigger = every(15, check_log_errors)

    # 3. Setup the LocalAgentConfig
    config = LocalAgentConfig(
        model="gemini-3.5-flash",
        system_instructions=SYSTEM_INSTRUCTIONS,
        tools=[
            read_application_logs,
            run_test_suite,
            modify_source_file,
            trigger_gcp_redeploy
        ],
        triggers=[health_trigger, log_trigger]
    )

    logging.info("Starting Chief of Engineering Agent...")
    
    # 4. Initialize and run the Agent
    async with Agent(config) as agent:
        logging.info("Chief of Engineering Agent is active and monitoring in the background.")
        
        # Keep the main process running to let the background triggers work
        while True:
            await asyncio.sleep(3600)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Chief of Engineering Agent stopped.")
