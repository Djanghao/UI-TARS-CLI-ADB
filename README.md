# UI-TARS CLI + ADB

A specialized command-line tool for UI-TARS focused exclusively on **Android device automation via ADB (Android Debug Bridge)**. This is a streamlined extraction from the larger UI-TARS-desktop project, containing only the essential components needed for CLI-driven ADB operations.

## 🎯 Project Scope

### ✅ Included Features
- **CLI Interface** - Command-line tool for ADB automation
- **ADB Operator** - Android device interaction via ADB commands
- **UI-TARS SDK Core** - Essential GUIAgent, Model, and Action Parser
- **Model Integration** - OpenAI-compatible API support for vision-language models
- **Action Parsing** - Parse model predictions into ADB commands

### ❌ Explicitly Excluded Features
- Browser automation (Puppeteer, Playwright, etc.)
- Desktop/computer control (NutJS, system automation)
- Electron-based desktop applications
- Web UI interfaces
- Any non-ADB device operators
- Server/headless modes
- Multi-modal agents beyond ADB

## 🚀 Quick Start

### Prerequisites

1. **ADB (Android Debug Bridge)** - Must be installed and accessible in PATH
2. **Android Device** - Connected via USB with USB debugging enabled
3. **Node.js** - Version 18 or higher
4. **Vision-Language Model API** - OpenAI-compatible API (GPT-4 Vision, Claude, etc.)

### Installation

```bash
# Clone this repository
git clone <repository-url>
cd UI-TARS-CLI-ADB

# Install dependencies
npm install

# Build the project
npm run build

# Make CLI globally available (optional)
npm link
```

### Basic Usage

```bash
# Start with interactive prompts
npm start

# Or use the built CLI directly
node bin/index.js start

# Provide configuration via command line
npm start -- start \
  --baseURL "https://api.openai.com/v1" \
  --apiKey "your-api-key" \
  --model "gpt-4-vision-preview" \
  --query "Open WhatsApp and send 'Hello' to John"

# Use with preset configuration
npm start -- start \
  --presets "https://example.com/config.yaml" \
  --query "Take a screenshot and scroll down"
```

## 📱 ADB Setup

### Enable USB Debugging on Android

1. Go to **Settings** > **About phone**
2. Tap **Build number** 7 times to enable Developer options
3. Go to **Settings** > **Developer options**
4. Enable **USB debugging**
5. Connect device via USB and authorize the computer

### Verify ADB Connection

```bash
# Check if device is detected
adb devices

# Should show something like:
# List of devices attached
# ABCD1234567890    device
```

### Chinese Input Support (Optional)

For Chinese text input, install ADBKeyboard:

```bash
# Download ADBKeyboard.apk from GitHub
# Install it on your device
adb install ADBKeyboard.apk

# Activate the input method
adb shell ime set com.android.adbkeyboard/.AdbIME
```

## 🎮 Supported ADB Actions

The ADB operator supports the following actions:

- **click(start_box='[x1, y1, x2, y2]')** - Tap on screen coordinates
- **type(content='text')** - Input text (supports Chinese with ADBKeyboard)
- **swipe(start_box='[x1, y1, x2, y2]', end_box='[x3, y3, x4, y4]')** - Swipe gesture
- **scroll(start_box='[x1, y1, x2, y2]', direction='up/down/left/right')** - Scroll in direction
- **hotkey(key='enter/back/home/backspace/delete/menu/power/volume_up/volume_down/mute/lock')** - Hardware keys
- **wait()** - Wait 2 seconds and take screenshot
- **press_home()** - Press home button
- **finished()** - Complete the task
- **call_user()** - Request user assistance

## 📝 Configuration

### Configuration File

The CLI automatically creates `~/.ui-tars-adb-cli.json`:

```json
{
  "baseURL": "https://api.openai.com/v1",
  "apiKey": "your-api-key",
  "model": "gpt-4-vision-preview"
}
```

### Preset Configuration (YAML)

Create a YAML preset file:

```yaml
# config.yaml
vlmApiKey: "your-api-key"          # or apiKey
vlmBaseUrl: "https://api.openai.com/v1"  # or baseURL
vlmModelName: "gpt-4-vision-preview"     # or model
```

Use with:
```bash
npm start -- start --presets "https://example.com/config.yaml"
```

## 🛠️ Development

### Project Structure

```
UI-TARS-CLI-ADB/
├── src/
│   ├── cli/              # CLI commands and interface
│   │   ├── commands.ts   # Command definitions
│   │   └── start.ts      # Main CLI logic
│   ├── operators/        # ADB operator implementation
│   │   └── adb.ts        # ADB device automation
│   ├── sdk/              # Core UI-TARS SDK components
│   │   ├── gui-agent.ts  # Main agent orchestration
│   │   ├── model.ts      # LLM API integration
│   │   └── types.ts      # SDK type definitions
│   ├── action-parser/    # Parse model outputs to actions
│   │   └── index.ts      # Action parsing logic
│   ├── shared/           # Shared utilities and types
│   │   ├── types.ts      # Common type definitions
│   │   ├── constants.ts  # Shared constants
│   │   └── utils.ts      # Utility functions
│   └── index.ts          # Main export file
├── bin/
│   └── index.js          # CLI entry point
└── package.json          # Dependencies and scripts
```

### Build Commands

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build

# Run tests
npm test

# Start development version
npm start
```

### Adding New Features

Since this project is focused exclusively on CLI + ADB functionality:

1. **New ADB actions** - Extend the `AdbOperator` class in `src/operators/adb.ts`
2. **CLI enhancements** - Modify `src/cli/commands.ts` and `src/cli/start.ts`
3. **Model improvements** - Update `src/sdk/model.ts` for better LLM integration

## 🔧 Troubleshooting

### Common Issues

**"No Android devices found"**
- Ensure USB debugging is enabled
- Check `adb devices` shows your device
- Try different USB cable or port

**"Permission denied"**
- Grant computer access when prompted on Android device
- Restart ADB: `adb kill-server && adb start-server`

**"Model API errors"**
- Verify API key and base URL are correct
- Check model name is supported by your API provider
- Ensure sufficient API credits/quota

**"Action parsing errors"**
- Model output format might be incompatible
- Try different model or adjust system prompt
- Check model supports vision capabilities

## 📄 License

Apache-2.0 - see LICENSE file for details.

## 🤝 Contributing

Since this is a focused extraction for CLI + ADB functionality only:

1. Ensure changes relate to CLI or ADB functionality
2. Do not add features outside the stated scope
3. Test with real Android devices
4. Follow existing code patterns and structure

## 📚 Related Projects

- **UI-TARS-desktop** - Full desktop application with browser and system automation
- **Android ADB Documentation** - https://developer.android.com/studio/command-line/adb
- **OpenAI Vision API** - https://platform.openai.com/docs/guides/vision 