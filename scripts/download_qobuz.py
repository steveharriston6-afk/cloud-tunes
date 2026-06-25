#!/usr/bin/env python3
import os
import sys
import argparse
import subprocess
import hashlib
from pathlib import Path

# Try to import tomlkit (will be run using the venv python)
try:
    import tomlkit
except ImportError:
    # If not running in venv, we will run inside venv
    pass

def load_env_dir():
    """Load LOCAL_SONGS_DIR from .env file if it exists."""
    project_dir = Path(__file__).resolve().parent.parent
    env_path = project_dir / ".env"
    if env_path.exists():
        with open(env_path, "r") as f:
            for line in f:
                if line.strip().startswith("LOCAL_SONGS_DIR="):
                    parts = line.strip().split("=", 1)
                    if len(parts) == 2:
                        # Strip quotes if any
                        val = parts[1].strip("'\"")
                        return os.path.expanduser(val)
    return os.path.expanduser("~/Downloads/Songs")

def get_venv_bin():
    """Get the path to the rip binary in the virtual environment."""
    project_dir = Path(__file__).resolve().parent.parent
    venv_rip = project_dir / "venv" / "bin" / "rip"
    if venv_rip.exists():
        return str(venv_rip)
    # Fallback to system rip
    return "rip"

def get_venv_python():
    """Get the path to the python binary in the virtual environment."""
    project_dir = Path(__file__).resolve().parent.parent
    venv_python = project_dir / "venv" / "bin" / "python"
    if venv_python.exists():
        return str(venv_python)
    return sys.executable

def main():
    # If tomlkit is not loaded, we re-run ourselves using the venv python
    try:
        import tomlkit
    except ImportError:
        venv_python = get_venv_python()
        if venv_python != sys.executable:
            os.execv(venv_python, [venv_python] + sys.argv)
        else:
            print("Error: tomlkit is not installed. Please install it using pip.")
            sys.exit(1)

    parser = argparse.ArgumentParser(description="Download Qobuz tracks in FLAC highest available quality using streamrip.")
    parser.add_argument("--url", required=True, help="Qobuz track/album/playlist URL to download")
    parser.add_argument("--token", help="Qobuz user auth token (JWT from play.qobuz.com)")
    parser.add_argument("--userid", help="Qobuz user ID (required if using auth token)")
    parser.add_argument("--email", help="Qobuz email address")
    parser.add_argument("--password", help="Qobuz plaintext password")
    parser.add_argument("--quality", type=int, choices=[1, 2, 3, 4], default=4, help="Qobuz Quality: 1=320k MP3, 2=CD FLAC, 3=24-bit/96kHz FLAC, 4=24-bit/192kHz FLAC (default: 4)")
    parser.add_argument("--output-dir", help="Directory where files will be saved")
    
    args = parser.parse_args()

    # Determine paths
    config_path = Path.home() / ".config" / "streamrip" / "config.toml"
    
    # Initialize default config if not exists by running 'rip' help once
    if not config_path.exists():
        print("Initializing streamrip default config...")
        rip_bin = get_venv_bin()
        subprocess.run([rip_bin, "--help"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    if not config_path.exists():
        print(f"Error: Config file not found at {config_path} even after initialization.")
        sys.exit(1)

    # Load and parse config
    with open(config_path, "r", encoding="utf-8") as f:
        config_content = f.read()
    
    config = tomlkit.parse(config_content)

    # 1. Update output folder
    output_dir = args.output_dir
    if not output_dir:
        output_dir = load_env_dir()
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    config["downloads"]["folder"] = output_dir
    print(f"Saving downloads to: {output_dir}")

    # 2. Update quality
    config["qobuz"]["quality"] = args.quality
    print(f"Set Qobuz download quality to: {args.quality} (Highest FLAC quality)")

    # 3. Update credentials
    has_credentials = False
    
    # Check if credentials are supplied via CLI
    if args.token:
        config["qobuz"]["use_auth_token"] = True
        config["qobuz"]["password_or_token"] = args.token
        if args.userid:
            config["qobuz"]["email_or_userid"] = args.userid
        else:
            # Prompt user for user ID since it's required with token
            userid = input("Enter your Qobuz User ID: ").strip()
            config["qobuz"]["email_or_userid"] = userid
        has_credentials = True
    elif args.email and args.password:
        config["qobuz"]["use_auth_token"] = False
        config["qobuz"]["email_or_userid"] = args.email
        # Hash password in MD5 if required, or store plaintext.
        # Actually streamrip's config comment says: "else enter the md5 hash of your plaintext password".
        # Let's compute MD5 hash.
        md5_pwd = hashlib.md5(args.password.encode("utf-8")).hexdigest()
        config["qobuz"]["password_or_token"] = md5_pwd
        has_credentials = True
    else:
        # Check if existing credentials exist in config.toml
        existing_user = config["qobuz"].get("email_or_userid", "")
        existing_pwd_token = config["qobuz"].get("password_or_token", "")
        if existing_user and existing_pwd_token:
            print(f"Using existing credentials from config: {existing_user}")
            has_credentials = True
        else:
            # Interactive prompt for credentials
            print("\n--- Qobuz Authentication Required ---")
            print("No credentials found. Please choose an option:")
            print("1. Enter Web Player Auth Token (Recommended - bypasses captcha)")
            print("2. Enter Email and Password")
            choice = input("Option (1/2): ").strip()
            
            if choice == "1":
                token = input("Enter Qobuz user_auth_token: ").strip()
                userid = input("Enter Qobuz User ID: ").strip()
                config["qobuz"]["use_auth_token"] = True
                config["qobuz"]["email_or_userid"] = userid
                config["qobuz"]["password_or_token"] = token
                has_credentials = True
            elif choice == "2":
                email = input("Enter Qobuz Email: ").strip()
                password = input("Enter Qobuz Password: ").strip()
                md5_pwd = hashlib.md5(password.encode("utf-8")).hexdigest()
                config["qobuz"]["use_auth_token"] = False
                config["qobuz"]["email_or_userid"] = email
                config["qobuz"]["password_or_token"] = md5_pwd
                has_credentials = True
            else:
                print("Invalid choice. Cannot authenticate.")
                sys.exit(1)

    # Save configuration
    with open(config_path, "w", encoding="utf-8") as f:
        f.write(tomlkit.dumps(config))
    print("Updated streamrip config successfully.")

    # 4. Run streamrip command to download
    rip_bin = get_venv_bin()
    cmd = [rip_bin, "url", args.url]
    print(f"\nRunning command: {' '.join(cmd)}")
    
    try:
        subprocess.run(cmd, check=True)
        print("\nDownload completed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"\nError: streamrip command failed with exit code {e.returncode}")
        print("Please check your credentials, internet connection, and subscription tier.")
        sys.exit(e.returncode)

if __name__ == "__main__":
    main()
