# DESIGN PHILOSOPHY - Antigravity Phone Connect

## Problem Statement
Developing with powerful AI models like Claude or Gemini in Antigravity often involves long "thinking" times or prolonged generation of large codebases. Developers are often "tethered" to their desks, waiting for a prompt to finish before they can review or provide the next instruction.

## The Solution: A Seamless Extension
Antigravity Phone Connect isn't a replacement for the desktop IDE; it's a **wireless viewport**. It solves the "tethering" problem by mirroring the state of the desktop session to any device on the local network.

## Design Principles

### 1. Robustness Over Precision
Selecting elements in a dynamically changing IDE like VS Code is brittle. This project prioritizes **Text-Based Selection** and **Fuzzy Matching**. Instead of looking for `.button-32x`, we look for an element that *looks like a button* and *contains the word "Gemini"*.

### 2. Zero-Impact Mirroring
The snapshot system clones the DOM before capturing. This ensures that the mirroring process doesn't interfere with the developer's cursor, scroll position, or focus on the Desktop machine.

### 3. Visual Parity (The Dark Mode Bridge)
VS Code themes have thousands of CSS variables. Instead of trying to mirror every variable perfectly, we use **Aggressive CSS Inheritance**. The frontend captures the raw HTML and wraps it in a modern, slate-dark UI that feels premium and natively mobile, regardless of the Desktop's theme.

### 4. Intentional Constraints (Local Network Only)
By default, the app is constrained to the local area network (LAN). This is an intentional security choice to ensure your proprietary project snapshots and AI tokens aren't exposed to the public internet without an explicit tunneling setup (like VPN or SSH).

## Human-Centric Features
- **The "Bathroom" Use Case**: Optimized for quick checking of status while away from the desk.
- **Thought Expansion**: The generation process often "hides" the reasoning. We added remote-click relay specifically so you can "peek" into the AI's internal thoughts from your phone.
- **Bi-directional Sync**: If you change the model on your Desktop, your phone updates automatically. The goal is for both devices to feel like parts of the same "brain".
