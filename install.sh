#!/bin/bash

# Sleekdo Installer
# Downloads and installs Sleekdo to your PATH

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

echo -e "${GREEN}Installing Sleekdo...${NC}"

# Detect OS and architecture
OS=""
ARCH=""
DOWNLOAD_URL=""

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="darwin"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    OS="windows"
else
    echo -e "${RED}Unsupported operating system: $OSTYPE${NC}"
    exit 1
fi

if [[ "$ARCH" == "" ]]; then
    case $(uname -m) in
        x86_64)
            ARCH="x64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            echo -e "${RED}Unsupported architecture: $(uname -m)${NC}"
            exit 1
            ;;
    esac
fi

# Construct the filename
FILENAME="sleekdo-${OS}-${ARCH}"
if [[ "$OS" == "windows" ]]; then
    FILENAME="${FILENAME}.exe"
else
    FILENAME="${FILENAME}"
fi

# Detect architecture for URL if not already set
if [[ "$ARCH" == "x64" ]]; then
    DOWNLOAD_URL="https://github.com/Deexv/sleekdo/releases/download/${GITHUB_TAG}/sleekdo-${OS}-x64.tar.gz"
elif [[ "$ARCH" == "arm64" ]]; then
    DOWNLOAD_URL="https://github.com/Deexv/sleekdo/releases/download/${GITHUB_TAG}/sleekdo-${OS}-arm64.tar.gz"
fi

if [[ "$OS" == "windows" ]]; then
    DOWNLOAD_URL="https://github.com/Deexv/sleekdo/releases/download/${GITHUB_TAG}/sleekdo-${OS}-x64.zip"
fi

echo -e "${YELLOW}Detected: ${OS} ${ARCH}${NC}"
echo -e "${YELLOW}Downloading from: $DOWNLOAD_URL${NC}"

# Download
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

if [[ "$OS" == "windows" ]]; then
    curl -L -o "$TEMP_DIR/sleekdo.exe" "$DOWNLOAD_URL"
else
    curl -L -o "$TEMP_DIR/sleekdo" "$DOWNLOAD_URL"
fi

# Verify download
if [[ "$OS" == "windows" ]]; then
    if [[ ! -f "$TEMP_DIR/sleekdo.exe" ]]; then
        echo -e "${RED}Download failed${NC}"
        exit 1
    fi
    chmod +x "$TEMP_DIR/sleekdo.exe"
else
    if [[ ! -f "$TEMP_DIR/sleekdo" ]]; then
        echo -e "${RED}Download failed${NC}"
        exit 1
    fi
    chmod +x "$TEMP_DIR/sleekdo"
fi

# Determine installation directory
if [[ -n "$SLEEKDO_DIR" ]]; then
    INSTALL_DIR="$SLEEKDO_DIR"
else
    if [[ "$OS" == "windows" ]]; then
        INSTALL_DIR="$HOME/.sleekdo"
    else
        INSTALL_DIR="$HOME/.local/bin"
    fi
fi

# Create installation directory
mkdir -p "$INSTALL_DIR"

# Install
if [[ "$OS" == "windows" ]]; then
    cp "$TEMP_DIR/sleekdo.exe" "$INSTALL_DIR/sleekdo.exe"
else
    cp "$TEMP_DIR/sleekdo" "$INSTALL_DIR/sleekdo"
fi

# Add to PATH if needed
if [[ "$OS" == "windows" ]]; then
    # Add to PATH for Windows
    CURRENT_PATH=$(powershell -Command "[Environment]::GetEnvironmentVariable('Path', 'User')")
    if [[ ":$CURRENT_PATH:" != *":$INSTALL_DIR:"* ]]; then
        powershell -Command "[Environment]::SetEnvironmentVariable('Path', '$CURRENT_PATH;$INSTALL_DIR', 'User')"
        echo -e "${YELLOW}Added $INSTALL_DIR to PATH${NC}"
    fi
else
    # Add to PATH for Unix-like systems
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        SHELL_RC=""
        if [[ -f "$HOME/.bashrc" ]]; then
            SHELL_RC="$HOME/.bashrc"
        elif [[ -f "$HOME/.zshrc" ]]; then
            SHELL_RC="$HOME/.zshrc"
        elif [[ -f "$HOME/.profile" ]]; then
            SHELL_RC="$HOME/.profile"
        fi

        if [[ -n "$SHELL_RC" ]]; then
            echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_RC"
            echo -e "${YELLOW}Added $INSTALL_DIR to PATH in $SHELL_RC${NC}"
        else
            echo -e "${RED}Could not find shell config file. Please add $INSTALL_DIR to your PATH manually.${NC}"
        fi
    fi
fi

echo -e "${GREEN}✓ Installed sleekdo to $INSTALL_DIR${NC}"

# Verify installation
if [[ "$OS" == "windows" ]]; then
    if command -v sleekdo.exe &> /dev/null; then
        echo -e "${GREEN}✓ sleekdo is now available in your PATH${NC}"
    else
        echo -e "${YELLOW}Note: You may need to restart your terminal for PATH changes to take effect${NC}"
    fi
else
    if command -v sleekdo &> /dev/null; then
        echo -e "${GREEN}✓ sleekdo is now available in your PATH${NC}"
    else
        echo -e "${YELLOW}Note: You may need to restart your terminal for PATH changes to take effect${NC}"
    fi
fi

echo ""
echo -e "${GREEN}Sleekdo installed successfully!${NC}"
echo ""
echo "To use Sleekdo:"
echo "  sleekdo --help"
echo ""
echo "To start with Pi CLI:"
echo "  sleekdo --pi"
echo ""
