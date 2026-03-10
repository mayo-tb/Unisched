import base64
import urllib.request
import os

diagrams = {
    "ga_flowchart": """graph TD
    Start[Initialize Population] --> Eval[Evaluate Fitness Vectorized]
    Eval --> TermCheck{Is Fitness 1.0 or Gen 200}
    TermCheck -- Yes --> End[Return Best Chromosome]
    TermCheck -- No --> Select[Tournament Selection]
    Select --> Cross[Single-Point Crossover]
    Cross --> Mutate[Adaptive Mutation]
    Mutate --> Elitism[Preserve Top 3]
    Elitism --> Eval"""
}

def get_mermaid_img(code, output):
    if os.path.exists(output):
        print(f"Skipping {output}, already exists.")
        return
    b64 = base64.b64encode(code.encode('utf-8')).decode('utf-8')
    url = f"https://mermaid.ink/img/{b64}?type=png&bgColor=white"
    print(f"Downloading {output}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            with open(output, 'wb') as f:
                f.write(response.read())
        print(f"Saved {output}")
    except Exception as e:
        print(f"Failed to download {output}: {e}")

if __name__ == '__main__':
    for name, code in diagrams.items():
        get_mermaid_img(code, f"{name}.png")
