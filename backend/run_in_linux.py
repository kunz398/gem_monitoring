#!/usr/bin/env python3
import os
import subprocess
import sys

def run_direct():
    print("Starting Python backend in Ubuntu environment...")
    
    # Check if we're in Docker (requirements should already be installed)
    if os.path.exists("requirements.txt"):
        print("Requirements file found - assuming dependencies are installed")
    else:
        print("Warning: requirements.txt not found")
    
    # Run the application
    print("Starting the application...")
    print("Server will be available at: http://0.0.0.0:8000")
    print("Press Ctrl+C to stop the server")
    
    try:
        # Use uvicorn directly since it should be installed
        subprocess.run([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"])
    except KeyboardInterrupt:
        print("\nServer stopped.")
    except FileNotFoundError:
        print("Error: uvicorn not found. Please install it first:")
        print("pip3 install uvicorn fastapi")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_direct() 