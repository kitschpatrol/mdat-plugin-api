import type { MinimalNode, MinimalSourceFile } from 'typedoc'
import { Logger, LogLevel } from 'typedoc'
import { log } from './log'

/**
 * Forwards TypeDoc's log messages to the library logger, so consumers control
 * where they go via `setLogger`. TypeDoc's info-level chatter ("Loaded plugin",
 * "markdown generated at ...") is demoted to debug since it's noise in an mdat
 * run.
 */
export class LibraryLogger extends Logger {
	override log(message: string, level: LogLevel): void {
		super.log(message, level)

		if (level < this.level || level === LogLevel.None) {
			return
		}

		if (level === LogLevel.Error) {
			log.error(message)
		} else if (level === LogLevel.Warn) {
			log.warn(message)
		} else {
			log.debug(message)
		}
	}

	/**
	 * Validation warnings flag types that are referenced but not exported and
	 * links that don't resolve. Those show up in the generated Markdown anyway,
	 * and nagging on every mdat run isn't helpful, so they go to debug.
	 */
	override validationWarning(
		text: string,
		...args: [MinimalNode?] | [number, MinimalSourceFile]
	): void {
		this.validationWarningCount += 1
		log.debug(this.addContext(text, LogLevel.Warn, ...args))
	}
}
