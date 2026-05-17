<!-- title -->

# mdat-plugin-api

<!-- /title -->

<!-- badges -->

[![NPM Package mdat-plugin-api](https://img.shields.io/npm/v/mdat-plugin-api.svg)](https://npmjs.com/package/mdat-plugin-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/kitschpatrol/mdat-plugin-api/actions/workflows/ci.yml/badge.svg)](https://github.com/kitschpatrol/mdat-plugin-api/actions/workflows/ci.yml)

<!-- /badges -->

<!-- short-description -->

**Mdat plugin to generate API documentation from TypeScript source files using JSDoc and type information.**

<!-- /short-description -->

## Overview

_**This is a plugin for the [mdat CLI tool](https://github.com/kitschpatrol/mdat), which is a simple Markdown templating system optimized for embedding dynamic content in repository readmes and the like.**_

This plugin automatically transforms a CLI command's `--help` output into nicely formatted Markdown tables.

The rule also recursively calls `--help` on any subcommands found for inclusion in the output.

Currently, the rule can parse help output in the format provided by [Commander](https://github.com/tj/commander.js)-, [Yargs](https://yargs.js.org)-, and [Meow](https://github.com/sindresorhus/meow)-based tools. If parsing fails, the rule will fall back to show the raw help output in a regular code block instead.

## Getting started

### Dependencies

We'll assume you have [mdat](https://github.com/kitschpatrol/mdat) installed either globally or in your local project.

### Installation

Install the plugin as a development dependency:

```bash
pnpm add -D mdat-plugin-api
```

Register the plugin in your mdat config file, e.g. `mdat.config.ts`:

```ts
import { defineConfig } from 'mdat'
import cliHelp from 'mdat-plugin-api'

export default defineConfig({
  ...cliHelp,
})
```

## Usage

Assuming you have an executable with a `--help` flag on your path or in your project's scope:

```markdown
<!-- cli-help({ command: "mdat", depth: 1 }) -->
```

Then run the `mdat` CLI command on your Markdown file to expand the rule and embed the tabular help output:

````markdown
<!-- cli-help({ command: "mdat", depth: 1 }) -->

#### Command: `mdat`

Work with MDAT placeholder comments in any Markdown file.

If no command is provided, `mdat expand` is run by default.

Usage:

```txt
mdat [command]
```

| Positional Argument | Description                                      | Type     |
| ------------------- | ------------------------------------------------ | -------- |
| `files`             | Markdown file(s) with MDAT placeholder comments. | `string` |

| Command    | Argument                | Description                                                    |
| ---------- | ----------------------- | -------------------------------------------------------------- |
| `expand`   | `<files..>` `[options]` | Expand MDAT placeholder comments. _(Default command.)_         |
| `check`    | `<files..>` `[options]` | Validate a Markdown file containing MDAT placeholder comments. |
| `collapse` | `<files..>` `[options]` | Collapse MDAT placeholder comments.                            |
| `readme`   | `[command]`             | Work with MDAT comments in your readme.md.                     |

| Option              | Description                                                                                                                                                                                                 | Type      | Default                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| `--config`          | Path(s) to files containing MDAT configuration.                                                                                                                                                             | `array`   | Configuration is loaded if found from the usual places, or defaults are used. |
| `--rules`<br>`-r`   | Path(s) to files containing MDAT comment expansion rules.                                                                                                                                                   | `array`   |                                                                               |
| `--output`<br>`-o`  | Output file directory.                                                                                                                                                                                      | `string`  | Same directory as input file.                                                 |
| `--name`<br>`-n`    | Output file name.                                                                                                                                                                                           | `string`  | Same name as input file. Overwrites the input file.                           |
| `--meta`<br>`-m`    | Embed an extra comment at the top of the generated Markdown warning editors that certain sections of the document have been generated dynamically.                                                          | `boolean` |                                                                               |
| `--prefix`          | Require a string prefix before all comments to be considered for expansion. Useful if you have a bunch of non-MDAT comments in your Markdown file, or if you're willing to trade some verbosity for safety. | `string`  |                                                                               |
| `--print`           | Print the expanded Markdown to stdout instead of saving to a file. Ignores `--output` and `--name` options.                                                                                                 | `boolean` |                                                                               |
| `--verbose`         | Enable verbose logging. All verbose logs and prefixed with their log level and are printed to stderr for ease of redirection.                                                                               | `boolean` |                                                                               |
| `--help`<br>`-h`    | Show help                                                                                                                                                                                                   | `boolean` |                                                                               |
| `--version`<br>`-v` | Show version number                                                                                                                                                                                         | `boolean` |                                                                               |

<!-- /cli-help -->
````

The command is also aliased under the `<!-- cli -->` keyword.

This would have equivalent output to the above:

```markdown
<!-- cli({ command: "mdat", depth: 1 }) -->
```

If you embed the rule without any arguments, it will look for the binary file listed in the closest `package.json` file and run it with `--help`. This is what you want if you're documenting a package's CLI options in its readme.md file:

```markdown
<!-- cli-help -->
```

### Supported CLI frameworks

#### [Yargs](https://yargs.js.org)

Fully supported, including options, commands, positionals, choices, defaults, and type annotations.

The parser handles line-wrapped output by unwrapping continuation lines before parsing. However, when Yargs wraps command _arguments_ onto new lines at very narrow terminal widths (e.g. below \~70 columns), those wrapped argument lines are indistinguishable from new command rows and cannot be reliably unwrapped. In practice, this is rare.

For the most reliable parsing if you control the upstream project, configure your Yargs CLI to disable wrapping:

```ts
yargs(process.argv).wrap(process.stdout.isTTY ? Math.min(120, yargs.terminalWidth()) : 0)
```

This outputs unwrapped help text when piped, while preserving normal wrapping for interactive use.

#### [Commander](https://github.com/tj/commander.js)

Fully supported, including options, commands, arguments (positionals), and parenthesized defaults with optional environment variable annotations (e.g. `(default: "value", env: MY_VAR)`).

The parser handles line-wrapped output by unwrapping continuation lines before parsing. Commander's built-in `help` command is automatically filtered from subcommand recursion to avoid duplicate output.

#### [Meow](https://github.com/sindresorhus/meow)

Should be fully supported or nearly so.

## Development notes

Parsing arbitrary `--help` output is a bit tricky.

You're right to think that an LLM could make quick work of this kind of "fuzzy text to structured data" transcription. However, when this tool was originally developed in 2024, testing a language model approach yielded sub-par results, so I pursued a traditional lexer/parser approach instead. There is also the logistical overhead of providing a smart-enough model both locally and in CI, where this tool frequently runs; it's technically feasible, but unpleasant. While the current hand-tuned parsers are admittedly a brittle tangle, future versions may revisit the LLM approach.

In terms of prior art, the [jc](https://github.com/kellyjonbrazil/jc) project stands out as a heroic collection of CLI-tool output parsers, but does not currently implement help output parsing. It might be interesting to try to contribute mdat's help parsing implementations to jc.

Currently, the parser implementation lives in this repository because I really only use it in the context of my CLI tool readme files. In theory, it really belongs in a separate package.

## Maintainers

[kitschpatrol](https://github.com/kitschpatrol)

<!-- contributing -->

## Contributing

[Issues](https://github.com/kitschpatrol/mdat-plugin-api/issues) and pull requests are welcome.

<!-- /contributing -->

<!-- license -->

## License

[MIT](license.txt) © Eric Mika

<!-- /license -->

<!-- api -->

### Function: setLogger()

> **setLogger**(`logger?`): `void`

Set the logger instance for the module. Export this for library consumers to
inject their own logger.

#### Parameters

| Parameter | Type                                           | Description                                                                |
| --------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| `logger?` | `ILogBasic` \| `ILogLayer`<`ILogLayer`<`any`>> | Accepts either a LogLayer instance or a Console- or Stream-like log target |

#### Returns

`void`

### Type Alias: ApiRuleOptions

> **ApiRuleOptions** = `object`

Options for the `<!-- api -->` rule.

Pass these as a JSON5 argument in the comment tag, e.g.
`<!-- api({entryPoint: "src/index.ts", headingLevel: 2}) -->`.

#### Properties

| Property        | Type     | Default value | Description                                                                                                                                                                   |
| --------------- | -------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entryPoint?`   | `string` | `undefined`   | Path to the TypeScript entry point file. If omitted, the entry point is inferred from `package.json` fields (`exports`, `types`, `main`) or common defaults (`src/index.ts`). |
| `headingLevel?` | `number` | `3`           | Starting heading level for the generated documentation (1-6).                                                                                                                 |
| `tsconfig?`     | `string` | `undefined`   | Path to a custom `tsconfig.json` file. Auto-detected if omitted.                                                                                                              |

### Variable: default

> `const` **default**: `Config`

mdat plugin that generates API documentation from TypeScript source files.

Uses TypeDoc and typedoc-plugin-markdown under the hood to extract JSDoc
descriptions, type signatures, `@example` code blocks, and parameter tables
from public exports.

#### Example

Register in your `mdat.config.ts`:

```ts
import { defineConfig } from 'mdat'
import apiPlugin from 'mdat-plugin-api'

export default defineConfig({
  ...apiPlugin,
})
```

Then use in your Markdown file:

```markdown
#### API

<!-- api -->
```

<!-- /api -->
