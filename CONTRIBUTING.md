# CONTRIBUTING - Antigravity Phone Connect

First off, thank you for considering contributing to Antigravity Phone Connect! It's people like you that make the AI development ecosystem so exciting.

## How to Contribute

### 1. Reporting Bugs
- **Check existing issues** to see if the bug has already been reported.
- **Provide context**: What OS are you using? Which port is Antigravity running on?
- **Logs**: Include the output of `server.js` (the console logs) when the error occurred.

### 2. Suggesting Features
- Open a "Feature Request" on GitHub.
- Describe the use case (e.g., "I wish I could scroll the desktop from my phone").

### 3. Development Workflow
1.  **Fork** the repository.
2.  Create a **new branch** (`git checkout -b feature/amazing-feature`).
3.  **Implement** your changes.
    - If you are changing the UI, please test on a real mobile device screen.
    - If you are changing the server, ensure CDP discovery logic is still backward compatible.
4.  **Validate** your changes (see the checklist below).
5.  **Submit a PR** with a clear description of what changed and why.

## Local Setup
1.  Clone your fork: `git clone https://github.com/krishnakanthb13/Antigravity-Shit-Chat.git`
2.  Install dependencies: `npm install`
3.  Start Antigravity with: `antigravity . --remote-debugging-port=9000`
4.  Run the monitor: `node server.js`

## Pre-submission Checklist
- [ ] Code follows existing style (clean, documented JS).
- [ ] No hardcoded personal IPs or credentials.
- [ ] Snapshot capture still works with the latest Antigravity version.
- [ ] UI is responsive on small (iPhone SE) and large (iPad) screens.
- [ ] All documentation updated if new features were added.

## Author
**Krishna Kanth B** (@krishnakanthb13)
