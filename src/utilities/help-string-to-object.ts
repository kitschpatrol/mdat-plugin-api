import type { ProgramInfo } from './parsers/index'
import { log } from './log'
import parsers from './parsers/index'

/**
 * Tries to parse a help string into an object through a process of trial and
 * error with the available parsers.
 *
 * Generally, there's no way to know which framework was used to generate a
 * particular CLI tool without inspecting the output for particular formatting
 * patterns.
 */
export function helpStringToObject(helpString: string): ProgramInfo | undefined {
	for (const [parserName, helpStringToObjectFunction] of Object.entries(parsers)) {
		log.debug(`Trying to parse help string with ${parserName} parser...`)

		try {
			return helpStringToObjectFunction(helpString)
		} catch (error) {
			if (error instanceof Error) {
				log.debug(`Parser "${parserName}" did not match: ${String(error)}`)
			}

			// Try next parser
			continue
		}
	}

	log.debug('Could not parse help string with any parser')
	return undefined
}
