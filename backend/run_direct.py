#!/usr/bin/env python3
import os
import subprocess
import sys

def run_direct():
    print("Setting up Python backend...")
    
    # Try to install requirements globally first
    print("Installing requirements globally...")
    try:
        subprocess.run(["pip3", "install", "--break-system-packages", "-r", "requirements.txt"], check=True)
        print("Requirements installed successfully!")
        use_venv = False
    except subprocess.CalledProcessError as e:
        print(f"Global installation failed: {e}")
        print("Creating virtual environment as fallback...")
        
        # Create virtual environment as fallback
        try:
            subprocess.run([sys.executable, "-m", "venv", "venv"], check=True)
            print("Virtual environment created successfully!")
            
            # Install requirements in venv
            subprocess.run(["venv/bin/pip", "install", "-r", "requirements.txt"], check=True)
            print("Requirements installed in virtual environment!")
            use_venv = True
        except subprocess.CalledProcessError as e2:
            print(f"Failed to create virtual environment: {e2}")
            print("Trying with --user flag...")
            try:
                subprocess.run(["pip3", "install", "--user", "--break-system-packages", "-r", "requirements.txt"], check=True)
                print("Requirements installed with --user flag!")
                use_venv = False
            except subprocess.CalledProcessError as e3:
                print(f"All installation methods failed: {e3}")
                return
    
    # Run the application
    print("Starting the application...")
    print("Server will be available at: http://localhost:8011")
    print("Press Ctrl+C to stop the server")
    
    try:
        if use_venv:
            subprocess.run(["venv/bin/python", "-m", "uvicorn", "app.main:app", "--host", "localhost", "--port", "8011", "--reload"])
        else:
            subprocess.run([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "localhost", "--port", "8011", "--reload"])
    except KeyboardInterrupt:
        print("\nServer stopped.")

if __name__ == "__main__":
    run_direct() 