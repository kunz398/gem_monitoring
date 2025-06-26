import subprocess

def run_command(cmd):
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except subprocess.CalledProcessError:
        return False

print("Ping test:")
if run_command(["ping", "-c", "2", "127.0.0.1"]):
    print("Ping test: Success")
else:
    print("Ping test: Failed")

print("\nNetcat test (google.com:80):")
if run_command(["nc", "-zv", "google.com", "80"]):
    print("Netcat test: Success")
else:
    print("Netcat test: Failed")

print("\nNetcat test (localhost:80):")
if run_command(["nc", "-zv", "127.0.0.1", "80"]):
    print("Netcat test on localhost: Success")
else:
    print("Netcat test on localhost: Failed")

print("\nCurl test (www.google.com):")
if run_command(["curl", "-Is", "http://www.google.com"]):
    print("Curl test: Success")
else:
    print("Curl test: Failed") 