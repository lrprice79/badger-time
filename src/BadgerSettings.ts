type LocaleSubscriber = (locale: Intl.Locale) => void;

/**
 * Global defaults for BadgerSett.
 *
 * Set once at app startup; all BadgerSett instances created without an explicit
 * locale or timezone will inherit these values.
 *
 * Use `setLocale()` instead of setting `defaultLocale` directly when you need
 * subscribers to be notified (e.g. on a language switcher).
 *
 * @example
 * ```ts
 * // App startup
 * BadgerSettings.defaultTimeZone = "Europe/Stockholm";
 *
 * // Language switcher
 * const unsub = BadgerSettings.subscribe(locale => rerenderDates());
 * BadgerSettings.setLocale(new Intl.Locale("sv-SE"));
 *
 * // Cleanup (e.g. component unmount)
 * unsub();
 * ```
 */
export class BadgerSettings {
    static defaultLocale: Intl.Locale | undefined = undefined;
    static defaultTimeZone: string | undefined = undefined;

    private static subscribers: Set<LocaleSubscriber> = new Set();

    /**
     * Updates `defaultLocale` and notifies all active subscribers.
     * Prefer this over setting `defaultLocale` directly when reactivity is needed.
     */
    static setLocale(locale: Intl.Locale): void {
        BadgerSettings.defaultLocale = locale;
        BadgerSettings.subscribers.forEach(fn => fn(locale));
    }

    /**
     * Registers a callback that fires whenever `setLocale()` is called.
     * Returns an unsubscribe function — call it to stop receiving updates.
     *
     * @example
     * ```ts
     * // React
     * useEffect(() => BadgerSettings.subscribe(locale => setAppLocale(locale)), []);
     *
     * // Vue
     * BadgerSettings.subscribe(locale => localeRef.value = locale.baseName);
     * ```
     */
    static subscribe(fn: LocaleSubscriber): () => void {
        BadgerSettings.subscribers.add(fn);
        return () => BadgerSettings.subscribers.delete(fn);
    }

    /** Restores all defaults and clears all subscribers. */
    static reset(): void {
        BadgerSettings.defaultLocale = undefined;
        BadgerSettings.defaultTimeZone = undefined;
        BadgerSettings.subscribers.clear();
    }
}
