#!/usr/bin/env python3
"""
Crunchyfin Installer
====================
Installs the Crunchyroll-themed Jellyfin web client overhaul.

Supports two installation methods:
  1. Docker (recommended) – Injects CSS/JS into the Jellyfin container's index.html
  2. Branding XML – Writes CSS into Jellyfin's branding.xml (Custom CSS field)

Usage:
  python install.py --host 192.168.0.188 --user svetlin --password svetlin
  python install.py --host 192.168.0.188 --user svetlin --password svetlin --api-key YOUR_KEY
  python install.py --method branding --host 192.168.0.188 --user svetlin --password svetlin --api-key YOUR_KEY

Requirements:
  pip install paramiko requests
"""

import argparse
import os
import sys
import re

def load_file(name):
    """Load a file from the same directory as this script."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), name)
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def install_docker(host, user, password, container_name, api_key):
    """Inject CSS/JS into the Jellyfin container's index.html."""
    import paramiko

    css = load_file('crunchyroll.css')
    js = load_file('crunchyroll.js')

    # Replace placeholder API key if provided
    if api_key:
        js = js.replace('YOUR_API_KEY_HERE', api_key)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password)

    INDEX_PATH = '/usr/share/jellyfin/web/index.html'

    # Read current index.html
    cmd = f'echo {password} | sudo -S docker exec {container_name} cat {INDEX_PATH}'
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdout.channel.recv_exit_status()
    original = stdout.read().decode('utf-8', errors='replace')

    if not original.strip():
        print("ERROR: Could not read index.html from container. Check container name and permissions.")
        ssh.close()
        return False

    # Remove old injection if present
    original = re.sub(
        r'<!-- CRUNCHYROLL_OVERHAUL_START -->.*?<!-- CRUNCHYROLL_OVERHAUL_END -->\s*',
        '',
        original,
        flags=re.DOTALL
    )

    # Build injection block
    injection = f"""<!-- CRUNCHYROLL_OVERHAUL_START -->
<style>
{css}
</style>
<script>
{js}
</script>
<!-- CRUNCHYROLL_OVERHAUL_END -->
"""

    # Insert before </head>
    if '</head>' in original:
        new_html = original.replace('</head>', injection + '</head>')
    else:
        new_html = original + injection

    # Write back via temp file
    sftp = ssh.open_sftp()
    with sftp.open('/tmp/crunchyfin_index.html', 'w') as f:
        f.write(new_html)
    sftp.close()

    cmd = f'echo {password} | sudo -S docker cp /tmp/crunchyfin_index.html {container_name}:{INDEX_PATH}'
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdout.channel.recv_exit_status()

    # Cleanup
    ssh.exec_command('rm -f /tmp/crunchyfin_index.html')

    print(f"✓ Crunchyfin installed in container '{container_name}'")
    print(f"  Refresh your browser to see the new theme.")
    ssh.close()
    return True

def install_branding(host, user, password, api_key):
    """Install via Jellyfin branding.xml Custom CSS."""
    import paramiko

    css = load_file('crunchyroll.css')

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password)

    BRANDING_PATH = '/DATA/AppData/jellyfin/config/branding.xml'

    sftp = ssh.open_sftp()

    try:
        with sftp.open(BRANDING_PATH, 'r') as f:
            branding = f.read().decode('utf-8', errors='replace')
    except FileNotFoundError:
        branding = '''<?xml version="1.0" encoding="utf-8"?>
<BrandingOptions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <LoginDisclaimer />
  <CustomCss></CustomCss>
</BrandingOptions>'''

    # Replace or insert CustomCss
    css_escaped = css.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    if '<CustomCss>' in branding:
        branding = re.sub(
            r'<CustomCss>.*?</CustomCss>',
            f'<CustomCss>{css_escaped}</CustomCss>',
            branding,
            flags=re.DOTALL
        )
    else:
        branding = branding.replace(
            '</BrandingOptions>',
            f'  <CustomCss>{css_escaped}</CustomCss>\n</BrandingOptions>'
        )

    with sftp.open(BRANDING_PATH, 'w') as f:
        f.write(branding)
    sftp.close()

    print(f"✓ Crunchyfin CSS installed via branding.xml")
    print(f"  Note: JS features (hero banner, My Lists, etc.) require the Docker method.")
    print(f"  Restart Jellyfin to apply changes.")
    ssh.close()
    return True

def main():
    parser = argparse.ArgumentParser(
        description='Crunchyfin Installer – Crunchyroll theme for Jellyfin'
    )
    parser.add_argument('--host', required=True, help='Jellyfin server IP/hostname')
    parser.add_argument('--user', required=True, help='SSH username')
    parser.add_argument('--password', required=True, help='SSH password')
    parser.add_argument('--container', default='Jellyfin', help='Docker container name (default: Jellyfin)')
    parser.add_argument('--api-key', help='Jellyfin API key (for JS features)')
    parser.add_argument('--method', choices=['docker', 'branding'], default='docker',
                        help='Installation method (default: docker)')

    args = parser.parse_args()

    if args.method == 'docker':
        success = install_docker(args.host, args.user, args.password, args.container, args.api_key)
    else:
        success = install_branding(args.host, args.user, args.password, args.api_key)

    if success:
        print("\n🎉 Crunchyfin installation complete!")
    else:
        print("\n❌ Installation failed. Check the errors above.")
        sys.exit(1)

if __name__ == '__main__':
    main()
