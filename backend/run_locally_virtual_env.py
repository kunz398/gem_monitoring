import os
import subprocess
import sys
import platform

def find_venv_pip():
    """Find the correct pip path in the virtual environment"""
    possible_paths = [
        "venv/bin/pip",           # Unix/Linux/Mac
        "venv/Scripts/pip.exe",   # Windows
        "venv/Scripts/pip",       # Windows (without .exe)
        "venv/Lib/site-packages/pip",  # Alternative Windows path
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    # If no pip found, try to use the system pip with venv
    return None

def find_venv_uvicorn():
    """Find the correct uvicorn path in the virtual environment"""
    possible_paths = [
        "venv/bin/uvicorn",           # Unix/Linux/Mac
        "venv/Scripts/uvicorn.exe",   # Windows
        "venv/Scripts/uvicorn",       # Windows (without .exe)
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
    
    # If no uvicorn found, try to use the system uvicorn with venv
    return None

def run_local():
    print(f"Detected OS: {platform.system()}")
    print(f"Python executable: {sys.executable}")
    
    # Check if virtual environment exists
    if not os.path.exists("venv"):
        print("Creating virtual environment...")
        try:
            subprocess.run([sys.executable, "-m", "venv", "venv"], check=True)
            print("Virtual environment created successfully!")
        except subprocess.CalledProcessError as e:
            print(f"Failed to create virtual environment: {e}")
            return
    else:
        print("Virtual environment already exists.")
    
    # Find pip in virtual environment
    pip_path = find_venv_pip()
    if pip_path:
        print(f"Found pip at: {pip_path}")
        pip_cmd = [pip_path, "install", "-r", "requirements.txt"]
    else:
        print("Pip not found in venv, using system pip with venv activation...")
        if platform.system() == "Windows":
            pip_cmd = ["venv\\Scripts\\python.exe", "-m", "pip", "install", "-r", "requirements.txt"]
        else:
            pip_cmd = ["venv/bin/python", "-m", "pip", "install", "-r", "requirements.txt"]
    
    # Install requirements
    print("Installing requirements...")
    try:
        subprocess.run(pip_cmd, check=True)
        print("Requirements installed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"Failed to install requirements: {e}")
        return
    
    # Find uvicorn in virtual environment
    uvicorn_path = find_venv_uvicorn()
    if uvicorn_path:
        print(f"Found uvicorn at: {uvicorn_path}")
        uvicorn_cmd = [uvicorn_path, "app.main:app", "--host", "localhost", "--port", "8000", "--reload"]
    else:
        print("Uvicorn not found in venv, using system uvicorn with venv activation...")
        if platform.system() == "Windows":
            uvicorn_cmd = ["venv\\Scripts\\python.exe", "-m", "uvicorn", "app.main:app", "--host", "localhost", "--port", "8000", "--reload"]
        else:
            uvicorn_cmd = ["venv/bin/python", "-m", "uvicorn", "app.main:app", "--host", "localhost", "--port", "8000", "--reload"]
    
    # Run the application
    print("Starting the application...")
    print(f"Command: {' '.join(uvicorn_cmd)}")
    try:
        subprocess.run(uvicorn_cmd)
    except KeyboardInterrupt:
        print("\nApplication stopped by user.")
    except Exception as e:
        print(f"Failed to start application: {e}")

if __name__ == "__main__":
    run_local()