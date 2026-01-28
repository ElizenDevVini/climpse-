#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "  ┌─────────────────────────────────────┐"
echo "  │  Climpse Installer                  │"
echo "  │  AI that learns by watching you     │"
echo "  └─────────────────────────────────────┘"
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required but not installed."
  echo "Install Node.js 20+ from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js 20+ is required (found v$NODE_VERSION)"
  echo "Update Node.js from https://nodejs.org"
  exit 1
fi

echo "Node.js $(node -v) detected."

# Determine install directory
INSTALL_DIR="${CLIMPSE_DIR:-$HOME/.climpse/app}"

echo "Installing to $INSTALL_DIR..."

# Create install directory
mkdir -p "$INSTALL_DIR"

# Clone or download
if command -v git &> /dev/null; then
  if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull --quiet
  else
    echo "Cloning Climpse..."
    git clone --quiet https://github.com/ElizenDevVini/climpse-.git "$INSTALL_DIR"
  fi
else
  echo "Error: git is required for installation."
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
cd "$INSTALL_DIR"
npm install --production --quiet

# Build
echo "Building..."
npm run build --quiet

# Create symlink
SYMLINK_DIR="/usr/local/bin"
if [ -w "$SYMLINK_DIR" ]; then
  ln -sf "$INSTALL_DIR/dist/index.js" "$SYMLINK_DIR/climpse"
  chmod +x "$SYMLINK_DIR/climpse"
  echo "Installed climpse to $SYMLINK_DIR/climpse"
else
  # Try with user-local bin
  USER_BIN="$HOME/.local/bin"
  mkdir -p "$USER_BIN"
  ln -sf "$INSTALL_DIR/dist/index.js" "$USER_BIN/climpse"
  chmod +x "$USER_BIN/climpse"
  echo "Installed climpse to $USER_BIN/climpse"
  echo ""
  echo "Make sure $USER_BIN is in your PATH:"
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

echo ""
echo "Climpse installed successfully!"
echo ""
echo "Get started:"
echo "  climpse setup    # Configure Climpse"
echo "  climpse start    # Start observing"
echo ""
