# UI-TARS CLI

A command-line interface for automating Android devices via ADB using self-hosted UI-TARS or OpenAI-compatible vision-language models.

## Overview

UI-TARS CLI enables automated control of Android devices through natural language commands. It leverages vision-language models to interpret screenshots and execute actions via Android Debug Bridge (ADB), providing an intelligent automation layer for mobile testing, scripting, and task automation.

## Prerequisites

- **Node.js** 18 or higher
- **ADB (Android Debug Bridge)** installed and available in PATH
- **Android Device** with USB debugging enabled
- **Vision-Language Model API** - OpenAI-compatible endpoint (GPT-4 Vision, Claude, UI-TARS, etc.)

## Installation

```bash
git clone https://github.com/Djanghao/UI-TARS-CLI-ADB
cd UI-TARS-CLI-ADB
npm install
npm run build
```

## Quick Start

### Interactive Mode (Recommended)

Launch the CLI with interactive prompts:

```bash
npm start
```

On first run, you will be prompted to configure:
- **Base URL**: API endpoint (e.g., `http://localhost:8000/v1`)
- **API Key**: Authentication key (use any non-empty string for servers without auth)
- **Model**: Model identifier (e.g., `ui-tars`, `gpt-4-vision-preview`)

Configuration is saved to `ui-tars-cli.config.json`:

```json
{
  "baseURL": "http://localhost:8000/v1",
  "apiKey": "dummy",
  "model": "ui-tars"
}
```

### One-Shot Mode

Execute tasks directly with command-line arguments:

```bash
npm start -- \
  --baseURL "http://localhost:8000/v1" \
  --apiKey "dummy" \
  --model "ui-tars" \
  --query "Go to home and open Settings"
```

## Configuration

The CLI automatically creates and reads `ui-tars-cli.config.json` in the project directory. You can manually edit this file or let the interactive mode generate it.

## Command-Line Options

| Option | Description |
|--------|-------------|
| `--query <text>` | Natural language task instruction |
| `--baseURL <url>` | OpenAI-compatible API base URL (overrides config) |
| `--apiKey <key>` | API authentication key (overrides config) |
| `--model <name>` | Model identifier (overrides config) |
| `--device <id>` | Target device ID (from `adb devices`) |

## Device Management

The CLI automatically detects connected Android devices. If multiple devices are available, you will be prompted to select one, or you can specify a device directly:

```bash
npm start -- --device <device-id> --query "Take a screenshot"
```

List connected devices:
```bash
adb devices
```

## Local Deployment with vLLM

### Requirements

- vLLM >= 0.6.1 (recommended: 0.6.6)
- CUDA-compatible GPU with sufficient VRAM
- UI-TARS model weights

### Install vLLM

```bash
pip install -U transformers
VLLM_VERSION=0.6.6
CUDA_VERSION=cu124
pip install vllm==${VLLM_VERSION} --extra-index-url https://download.pytorch.org/whl/${CUDA_VERSION}
```

### Available UI-TARS Models

- **ui-tars-2B-SFT** - Smallest, fastest
- **ui-tars-7B-SFT** - Balanced performance
- **ui-tars-7B-DPO** - Recommended for 7B tier
- **ui-tars-72B-SFT** - High accuracy
- **ui-tars-72B-DPO** - Best performance (recommended)

### Launch vLLM Server

```bash
# For 7B models (tensor parallel = 1)
python -m vllm.entrypoints.openai.api_server \
  --served-model-name ui-tars \
  --model <path-or-hf-repo> \
  --limit-mm-per-prompt image=5 \
  --tp 1

# For 72B models (tensor parallel = 4)
python -m vllm.entrypoints.openai.api_server \
  --served-model-name ui-tars \
  --model <path-or-hf-repo> \
  --limit-mm-per-prompt image=5 \
  --tp 4
```

Default endpoint: `http://localhost:8000`

### Connect CLI to vLLM

```bash
npm start -- \
  --baseURL "http://localhost:8000/v1" \
  --apiKey "dummy" \
  --model "ui-tars" \
  --query "Open Weibo, go to Trending, scroll to read 10 items"
```

## Notes

- The CLI captures screenshots and sends them to the vision-language model via OpenAI's `image_url` data URL format
- `--limit-mm-per-prompt image=5` in vLLM matches the CLI's internal limit of 5 images per prompt
- For servers without authentication, any non-empty string can be used as `--apiKey` (required by OpenAI SDK)

## License

Apache-2.0

## Related Resources

- [UI-TARS Models](https://huggingface.co/ByteDance-Seed/UI-TARS-72B-DPO)
- [vLLM Documentation](https://docs.vllm.ai/)
- [Android ADB Guide](https://developer.android.com/studio/command-line/adb)
