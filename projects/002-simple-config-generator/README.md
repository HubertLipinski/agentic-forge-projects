# Simple Configuration File Generator

A command-line tool that generates basic configuration files (e.g., JSON, YAML) based on a predefined template and user-provided values. Useful for quickly scaffolding configuration for new projects, services, or applications.

## Description

`simple-config-generator` allows you to create configuration files dynamically. You provide an EJS template, specify the desired output format (JSON or YAML), and pass in key-value pairs as command-line arguments. The tool renders the template with your provided values and outputs the result to the console or a specified file.

## Features

*   **EJS Templating:** Leverage the power of EJS for flexible template creation.
*   **JSON & YAML Output:** Generate configuration in either JSON or YAML format.
*   **Command-Line Input:** Easily provide values for your template variables using simple key-value arguments.
*   **Nested Values:** Support for nested configuration structures using dot notation (e.g., `database.host=localhost`).
*   **File Output:** Redirect generated configuration to a file or print it to standard output.
*   **Customizable Templates:** Use your own EJS template files.

## Installation

You can install `simple-config-generator` globally using npm:

```bash
npm install -g simple-config-generator
```

Alternatively, if you clone the repository:

```bash
git clone https://github.com/yourusername/simple-config-generator.git
cd simple-config-generator
npm install
```

After cloning and installing dependencies, you can run the tool using `npx config-gen` or by linking it globally:

```bash
npm link
```

## Usage

The `config-gen` command-line tool accepts the following arguments and options:

```bash
config-gen [options] [inputValues...]
```

**Arguments:**

*   `inputValues...`: Zero or more key-value pairs to be used as variables in the template. Keys can be nested using dot notation (e.g., `key=value`, `nested.key=value`).

**Options:**

*   `-t, --template <templatePath>`: (Required) Path to the EJS template file.
*   `-o, --output <outputPath>`: Path to the output file. If not provided, output goes to stdout.
*   `-f, --format <format>`: Output format (`json` or `yaml`). Defaults to `json`.

## Examples

### Example 1: Generating a JSON configuration

Let's say you have a template file named `api.config.ejs` with the following content:

```ejs
{
  "serviceName": "<%= serviceName %>",
  "port": <%= port %>,
  "database": {
    "host": "<%= database.host %>",
    "port": <%= database.port %>,
    "user": "<%= database.user %>"
  },
  "logging": {
    "level": "<%= logging.level %>"
  }
}
```

You can generate a JSON configuration like this:

```bash
config-gen -t api.config.ejs -f json serviceName=MyAwesomeAPI port=8080 database.host=localhost database.port=5432 database.user=admin logging.level=info
```

**Expected Output (to stdout):**

```json
{
  "serviceName": "MyAwesomeAPI",
  "port": 8080,
  "database": {
    "host": "localhost",
    "port": 5432,
    "user": "admin"
  },
  "logging": {
    "level": "info"
  }
}
```

### Example 2: Generating a YAML configuration and saving to a file

Using the same `api.config.ejs` template, you can generate a YAML file:

```bash
config-gen -t api.config.ejs -f yaml serviceName=DataProcessor port=3000 database.host=db.example.com database.port=5432 database.user=data_user logging.level=debug -o config.yaml
```

This command will create a file named `config.yaml` with the following content:

```yaml
serviceName: DataProcessor
port: 3000
database:
  host: db.example.com
  port: 5432
  user: data_user
logging:
  level: debug
```

### Example 3: Simple template with default values

Template file `app.config.ejs`:

```ejs
{
  "appName": "<%= appName %>",
  "environment": "<%= environment %>"
}
```

Running with minimal input:

```bash
config-gen -t app.config.ejs appName=MyApp
```

**Expected Output (to stdout):**

```json
{
  "appName": "MyApp",
  "environment": ""
}
```
(Note: `environment` is an empty string as it was not provided.)

## Template Creation Guidelines

*   **EJS Syntax:** Use standard EJS tags for embedding JavaScript logic:
    *   `<%= variable %>`: Outputs the value of `variable` (HTML escaped).
    *   `<%= variable %>`: Outputs the value of `variable` (unescaped).
    *   `<% javascript code %>`: Executes JavaScript code without outputting anything.
*   **Data Structure:** The key-value pairs provided via the command line will be available as JavaScript variables within your EJS template. Dot notation in keys (e.g., `database.host`) will create nested objects.
*   **Output Format:** Ensure your template structure matches the desired output format (JSON or YAML). For example, if generating JSON, your template should produce valid JSON syntax.

## License

MIT License

Copyright (c) 2023 Your Name

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.