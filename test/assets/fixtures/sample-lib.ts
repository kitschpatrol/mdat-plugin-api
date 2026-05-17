/**
 * Configuration options for the greeting system.
 */
export type GreetingOptions = {
	/** Whether to use formal language. */
	formal?: boolean
	/** Maximum length of the greeting. */
	maxLength?: number
}

/**
 * A greeting result with metadata.
 */
export type GreetingResult = {
	/** The formatted greeting message. */
	message: string
	/** Timestamp when the greeting was generated. */
	timestamp: Date
}

/**
 * Supported greeting languages.
 */
export type Language = 'en' | 'es' | 'fr' | 'ja'

/**
 * Generate a personalized greeting.
 *
 * @param name - The name of the person to greet
 * @param options - Configuration for the greeting
 * @returns A greeting result with the message and metadata
 *
 * @example
 * ```ts
 * const result = greet('World')
 * console.log(result.message) // "Hello, World!"
 * ```
 *
 * @example
 * ```ts
 * const result = greet('Professor', { formal: true })
 * console.log(result.message) // "Good day, Professor."
 * ```
 */
export function greet(name: string, options?: GreetingOptions): GreetingResult {
	const { formal = false, maxLength } = options ?? {}
	let message = formal ? `Good day, ${name}.` : `Hello, ${name}!`

	if (maxLength !== undefined && message.length > maxLength) {
		message = message.slice(0, maxLength - 1) + '\u2026'
	}

	return { message, timestamp: new Date() }
}

/**
 * Translate a greeting to a different language.
 *
 * @param greeting - The greeting result to translate
 * @param language - Target language code
 * @returns A new greeting result in the target language
 */
export function translate(greeting: GreetingResult, language: Language): GreetingResult {
	const translations: Record<Language, string> = {
		en: greeting.message,
		es: greeting.message.replace('Hello', 'Hola'),
		fr: greeting.message.replace('Hello', 'Bonjour'),
		ja: greeting.message.replace('Hello', '\u3053\u3093\u306B\u3061\u306F'),
	}

	return {
		message: translations[language],
		timestamp: new Date(),
	}
}

/** Default maximum greeting length. */
export const MAX_GREETING_LENGTH = 100

/**
 * Create and immediately invoke a greeting with sensible defaults.
 *
 * This is the simplest way to generate a greeting — just pass a name.
 *
 * @param name - The name to greet
 * @returns The greeting message string
 *
 * @example
 * ```ts
 * import hello from 'sample-lib'
 * console.log(hello('World')) // "Hello, World!"
 * ```
 */
export default function hello(name: string): string {
	return greet(name).message
}

/**
 * A greeting generator that maintains state.
 *
 * @example
 * ```ts
 * const gen = new GreetingGenerator('en')
 * const result = gen.generate('World')
 * ```
 */
export class GreetingGenerator {
	private readonly language: Language

	/**
	 * Create a new greeting generator.
	 *
	 * @param language - The default language for greetings
	 */
	constructor(language: Language = 'en') {
		this.language = language
	}

	/**
	 * Generate a greeting in the configured language.
	 *
	 * @param name - The name to greet
	 * @param options - Optional greeting configuration
	 * @returns The greeting result
	 */
	generate(name: string, options?: GreetingOptions): GreetingResult {
		const result = greet(name, options)
		return translate(result, this.language)
	}
}
