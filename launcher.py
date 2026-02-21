import sys
import subprocess
import time
import random
import string
import os
import socket

# -----------------------------------------------------------------------------
# Dependency Management
# -----------------------------------------------------------------------------
def check_dependencies():
    """Checks and installs required Python packages."""
    needed = ["python-dotenv", "qrcode"]
    installed = []
    
    # Check what is missing
    for pkg in needed:
        try:
            if pkg == "python-dotenv": from dotenv import load_dotenv
            elif pkg == "qrcode": import qrcode
            installed.append(pkg)
        except ImportError:
            pass

    missing = [pkg for pkg in needed if pkg not in installed]
    
    if missing:
        print(f"📦 Installing missing dependencies: {', '.join(missing)}...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing)
            print("✅ Dependencies installed.\n")
        except Exception as e:
            print(f"❌ Failed to install dependencies: {e}")
            sys.exit(1)

def check_node_environment():
    """Checks for Node.js and installs npm dependencies if needed."""
    # 1. Check if Node is installed
    try:
        subprocess.check_call(["node", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("❌ Error: Node.js is not installed. Please install it from https://nodejs.org/")
        sys.exit(1)

    # 2. Check for node_modules
    if not os.path.exists("node_modules"):
        print("📦 'node_modules' missing. Installing Node.js dependencies...")
        try:
            is_windows = sys.platform == "win32"
            subprocess.check_call(["npm", "install"], shell=is_windows)
            print("✅ Node dependencies installed.\n")
        except Exception as e:
            print(f"❌ Failed to run 'npm install': {e}")
            sys.exit(1)

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def get_local_ip():
    """Robustly determines the local LAN IP address."""
    s = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def get_tailscale_ip():
    """Attempts to get the Tailscale IP address."""
    try:
        result = subprocess.run(
            ["tailscale", "ip", "-4"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return None

def get_tailscale_hostname():
    """Attempts to get the Tailscale hostname."""
    try:
        result = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            import json
            status = json.loads(result.stdout)
            dns_name = status.get("Self", {}).get("DNSName", "")
            if dns_name:
                return dns_name.rstrip(".")
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        pass
    return None

def generate_passcode():
    """Generates a 6-digit passcode."""
    return ''.join(random.choices(string.digits, k=6))

def print_qr(url):
    """Generates and prints a QR code to the terminal."""
    import qrcode
    qr = qrcode.QRCode(version=1, box_size=1, border=1)
    qr.add_data(url)
    qr.make(fit=True)
    qr.print_ascii(invert=True)

# -----------------------------------------------------------------------------
# Main Execution
# -----------------------------------------------------------------------------
def main():
    # 1. Setup Environment
    check_dependencies()
    check_node_environment()
    
    from dotenv import load_dotenv
    
    # Load .env if it exists
    load_dotenv()
    
    # Setup App Password (optional with Tailscale, but still useful)
    passcode = os.environ.get('APP_PASSWORD')
    if not passcode:
        passcode = generate_passcode()
        os.environ['APP_PASSWORD'] = passcode
        print(f"⚠️  No APP_PASSWORD in .env. Using temporary: {passcode}")

    # 2. Start Node.js Server
    print(f"🚀 Starting Antigravity Phone Connect Server...")
    
    # Clean up old logs
    with open("server_log.txt", "w") as f:
        f.write(f"--- Server Started at {time.ctime()} ---\n")

    node_cmd = ["node", "server.js"]
    node_process = None
    
    try:
        log_file = open("server_log.txt", "a")
        node_process = subprocess.Popen(node_cmd, stdout=log_file, stderr=log_file, env=os.environ.copy())
            
        time.sleep(2)
        if node_process.poll() is not None:
            print("❌ Server failed to start immediately. Check server_log.txt.")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Failed to launch node: {e}")
        sys.exit(1)

    # 3. Display Access Info
    try:
        ip = get_local_ip()
        port = os.environ.get('PORT', '3000')
        
        # Detect HTTPS
        protocol = "http"
        if os.path.exists('certs/server.key') and os.path.exists('certs/server.cert'):
            protocol = "https"
        
        local_url = f"{protocol}://{ip}:{port}"
        
        # Try to get Tailscale info
        ts_ip = get_tailscale_ip()
        ts_hostname = get_tailscale_hostname()
        
        print("\n" + "="*50)
        print(f"📡 ANTIGRAVITY PHONE CONNECT")
        print("="*50)
        print(f"🔗 Local URL:     {local_url}")
        
        if ts_ip:
            ts_url = f"{protocol}://{ts_ip}:{port}"
            print(f"🌐 Tailscale URL: {ts_url}")
        
        if ts_hostname:
            ts_host_url = f"{protocol}://{ts_hostname}:{port}"
            print(f"🏷️  Tailscale DNS:  {ts_host_url}")
        
        if passcode:
            print(f"🔑 Passcode:      {passcode}")
        
        # QR code — prefer Tailscale URL for phone access
        qr_url = local_url
        if ts_ip:
            qr_url = f"{protocol}://{ts_ip}:{port}"
        
        print(f"\n📱 Scan this QR Code to connect:")
        print_qr(qr_url)

        print("-" * 50)
        print("📝 Steps to Connect:")
        if ts_ip:
            print("1. Ensure Tailscale is running on your phone.")
            print("2. Scan the QR code OR open the Tailscale URL in your browser.")
        else:
            print("1. Ensure your phone is on the SAME Wi-Fi network as this computer.")
            print("   (Or install Tailscale on both devices for remote access)")
            print("2. Scan the QR code OR type the URL into your browser.")
        print("3. You should be connected automatically!")

        print("="*50)
        print("✅ Server is running in background. Logs -> server_log.txt")
        print("⌨️  Press Ctrl+C to stop.")
        
        # Keep alive loop
        last_log_pos = 0
        cdp_warning_shown = False
        
        while True:
            time.sleep(1)
            
            # Check process status
            if node_process.poll() is not None:
                print("\n❌ Server process died unexpectedly!")
                sys.exit(1)
                
            # Monitor logs for errors
            try:
                if os.path.exists("server_log.txt"):
                    with open("server_log.txt", "r", encoding='utf-8', errors='ignore') as f:
                        f.seek(last_log_pos)
                        new_lines = f.read().splitlines()
                        last_log_pos = f.tell()
                        
                        for line in new_lines:
                            if "CDP not found" in line and not cdp_warning_shown:
                                print("\n" + "!"*50)
                                print("❌ ERROR: Antigravity Editor Not Detected!")
                                print("!"*50)
                                print("   The server cannot see your editor.")
                                print("   1. Close Antigravity.")
                                print("   2. Re-open it with the debug flag:")
                                print("      antigravity . --remote-debugging-port=9000")
                                print("   3. Or use the 'Open with Antigravity (Debug)' context menu.")
                                print("!"*50 + "\n")
                                cdp_warning_shown = True
            except Exception:
                pass

    except KeyboardInterrupt:
        print("\n\n👋 Shutting down...")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        # Cleanup
        try:
            if node_process:
                node_process.terminate()
                try:
                    node_process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    node_process.kill()
        except:
            pass
        
        if 'log_file' in locals() and log_file:
            log_file.close()
        
        sys.exit(0)

if __name__ == "__main__":
    main()
