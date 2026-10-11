import os
import datetime

# Output directory relative to execution
output_dir = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(output_dir, exist_ok=True)

timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
filepath = os.path.join(output_dir, f"report_{timestamp}.txt")

with open(filepath, "w") as f:
    f.write(f"Executed successfully at {timestamp}\n")

print(f"File created: {filepath}")
