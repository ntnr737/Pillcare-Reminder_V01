import os
import subprocess
import logging

def read_application_logs(lines: int = 100) -> str:
    """Reads the last N lines of the backend server logs.

    Args:
        lines: The number of lines to retrieve (default: 100).
    """
    # In a real environment, this might query GCP Cloud Logging API.
    # For local testing, we read from a local log file.
    log_file = "/tmp/pillcare_backend.log"
    if not os.path.exists(log_file):
        return "Log file not found. App may not be running."
    
    try:
        with open(log_file, "r") as f:
            log_lines = f.readlines()
            return "".join(log_lines[-lines:])
    except Exception as e:
        return f"Failed to read logs: {str(e)}"

def run_test_suite() -> str:
    """Runs the backend test suite to verify code correctness and compatibility.

    Returns:
        The pytest execution output or error.
    """
    try:
        # Run pytest inside the backend virtual environment
        result = subprocess.run(
            ["pytest", "backend/tests"],
            capture_output=True,
            text=True,
            cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        )
        return f"Stdout:\n{result.stdout}\nStderr:\n{result.stderr}\nExit Code: {result.returncode}"
    except Exception as e:
        return f"Failed to run test suite: {str(e)}"

def modify_source_file(file_path: str, search_text: str, replace_text: str) -> str:
    """Applies a surgical code edit to fix a bug in a source file.

    Args:
        file_path: Relative path to the file (e.g. 'backend/server.py').
        search_text: The exact block of code to target.
        replace_text: The replacement block of code.
    """
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    abs_path = os.path.join(root_dir, file_path)
    
    if not os.path.exists(abs_path):
        return f"Error: File '{file_path}' does not exist."
    
    try:
        with open(abs_path, "r") as f:
            content = f.read()
        
        if search_text not in content:
            return f"Error: Could not find search text in {file_path}. Make sure it matches exactly."
        
        updated_content = content.replace(search_text, replace_text)
        with open(abs_path, "w") as f:
            f.write(updated_content)
            
        return f"Success: Modified {file_path} successfully."
    except Exception as e:
        return f"Error modifying file: {str(e)}"

def trigger_gcp_redeploy() -> str:
    """Triggers a new build and redeployment of the FastAPI backend to Google Cloud Run.

    Returns:
        Deployment execution message.
    """
    # In a real environment, this runs 'gcloud run deploy' or pushes to git to trigger Cloud Build
    try:
        # Commit changes and push to git
        subprocess.run(["git", "add", "."], check=True)
        subprocess.run(["git", "commit", "-m", "fix: automated correction by Chief of Engineering Agent"], check=True)
        subprocess.run(["git", "push", "origin", "main"], check=True)
        return "Successfully pushed fixes to GitHub! GCP Cloud Run is rebuilding and deploying."
    except Exception as e:
        return f"Failed to deploy/push changes: {str(e)}"
