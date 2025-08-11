# ocusage - OpenCode Usage Tracker

A command-line tool to track and analyze your opencode usage with detailed reports.

## Overview

`ocusage` is an **unofficial** CLI tool designed to help developers track and analyze their usage of opencode. This utility provides detailed reports on token consumption, costs, and model breakdowns, helping you gain insights into your development activities.

**Disclaimer:** This tool is not affiliated with, endorsed by, or officially supported by the opencode project or its creators.

## Features

*   **Daily Reports**: Get a summary of your opencode usage on a daily basis.
*   **Weekly Reports**: View aggregated usage data for each week.
*   **Monthly Reports**: Analyze your monthly opencode consumption and costs.
*   **Session Reports**: Track usage within specific coding sessions.
*   **Hourly Reports**: Break down usage by hour for granular analysis.
*   **Today's Report**: Quickly generate a report for the current day's usage.
*   **JSON/XML Output**: Export reports in machine-readable formats for further processing.
*   **Detailed Model Breakdown**: See which models are being used and their individual contributions to your overall usage.
*   **Configurable Data Directory**: Specify where your opencode usage data files are stored.

## Installation

### Global Installation (Recommended)

```bash
npm install -g ocusage
```

or with bun:

```bash
bun install -g ocusage
```

### Local Installation

```bash
npm install ocusage
```

### Development Installation

If you want to contribute or run from source:

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ocusage.git
   cd ocusage
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   bun install
   ```

3. Build the project:
   ```bash
   npm run build
   # or
   bun run build
   ```

4. Run during development:
   ```bash
   # With bun (arguments passed directly)
   bun run start today --show-models=false
   
   # With npm (requires -- to pass arguments)
   npm run start -- today --show-models=false
   ```

## Usage

After global installation, use the `ocusage` command directly:

```bash
ocusage <command> [options]
```

### General Options

These options can be used with most commands:

*   `--data-dir <path>`: Specify the directory where opencode usage data files are located. (Default: `~/.local/share/opencode/project`)
*   `--since <YYYY-MM-DD>`: Start date for the report.
*   `--until <YYYY-MM-DD>`: End date for the report.
*   `--json`: Output the report in JSON format.
*   `--xml`: Output the report in XML format (overrides `--json`).
*   `--show-models`: Show detailed model breakdown in reports (default: `true`).

### Commands

#### `today`

Generates a report for the current day's opencode usage.

```bash
ocusage today
```

#### `daily`

Generates a daily report of opencode usage within a specified date range.

```bash
ocusage daily --since 2023-01-01 --until 2023-01-31
```

#### `weekly`

Generates a weekly report of opencode usage.

```bash
ocusage weekly --since 2023-01-01 --until 2023-03-31
```

#### `monthly`

Generates a monthly report of opencode usage.

```bash
ocusage monthly --since 2023-01-01 --until 2023-12-31
```

#### `session`

Generates a report of opencode session usage.

```bash
ocusage session
```

#### `hourly`

Generates an hourly report of opencode usage.

```bash
ocusage hourly
```

#### `live`

(Experimental) Monitors opencode usage in real-time.

```bash
ocusage live
```

## Configuration

The default data directory for opencode usage files is `~/.local/share/opencode/project`. You can override this using the `--data-dir` option.

## Acknowledgments

This project was inspired by and builds upon the excellent work of:

- [ccusage](https://github.com/ryoppippi/ccusage) - A similar usage tracker that provided inspiration for the interface and functionality
- [opencode](https://github.com/sst/opencode) - The project that makes the usage data available for analysis

Special thanks to the maintainers and contributors of these projects for their innovative work in the developer tooling space.

## Contributing

Contributions are welcome! If you'd like to contribute to ocusage, please follow these steps:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and test them locally.
4.  Submit a pull request with a clear description of your changes.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
