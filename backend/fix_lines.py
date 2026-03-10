import os

def fix_file(filepath):
    with open(filepath, 'rb') as f:
        content = f.read()
    if b'\r\n' in content:
        print(f"Fixing {filepath}")
        content = content.replace(b'\r\n', b'\n')
        with open(filepath, 'wb') as f:
            f.write(content)
    else:
        print(f"No CRLF in {filepath}")

for file in os.listdir('.'):
    if file.endswith('.sh'):
        fix_file(file)
