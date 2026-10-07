import { useState } from "react";
type TranslatorInstance = {
  translate: (text: string) => Promise<string>;
  destroy: () => void;
};
type BrowserTranslator = {
  availability: (p: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<string>;
  create: (p: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor: (m: {
      addEventListener: (
        event: string,
        fn: (e: { loaded: number }) => void,
      ) => void;
    }) => void;
  }) => Promise<TranslatorInstance>;
};
const languages = [
  ["en", "English"],
  ["ta", "தமிழ்"],
  ["hi", "हिन्दी"],
  ["bn", "বাংলা"],
  ["te", "తెలుగు"],
  ["kn", "ಕನ್ನಡ"],
  ["mr", "मराठी"],
  ["fr", "Français"],
  ["es", "Español"],
  ["de", "Deutsch"],
  ["ja", "日本語"],
  ["ar", "العربية"],
];
export default function Translator() {
  const [source, setSource] = useState("en"),
    [target, setTarget] = useState("ta"),
    [text, setText] = useState(""),
    [result, setResult] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function translate() {
    setResult("");
    setStatus("");
    if (!text.trim()) {
      setStatus("Enter some text to translate.");
      return;
    }
    if (source === target) {
      setResult(text);
      setStatus("Original text · the languages match.");
      return;
    }
    const engine = (globalThis as unknown as { Translator?: BrowserTranslator })
      .Translator;
    if (!engine) {
      setStatus(
        "On-device translation is unavailable in this browser. Try a supported desktop Chrome browser. Your original text stays here.",
      );
      return;
    }
    setBusy(true);
    let instance: TranslatorInstance | undefined;
    try {
      const available = await engine.availability({
        sourceLanguage: source,
        targetLanguage: target,
      });
      if (available === "unavailable") {
        setStatus("This language pair is not available on this device.");
        return;
      }
      setStatus("Preparing on-device translation…");
      instance = await engine.create({
        sourceLanguage: source,
        targetLanguage: target,
        monitor: (m) =>
          m.addEventListener("downloadprogress", (e) =>
            setStatus(
              "Downloading language model: " + Math.round(e.loaded * 100) + "%",
            ),
          ),
      });
      setResult(await instance.translate(text));
      setStatus(
        "Machine translation · on this device. Check names, numbers and important instructions.",
      );
    } catch {
      setStatus(
        "Translation could not finish. Your original text is safe; try again.",
      );
    } finally {
      instance?.destroy();
      setBusy(false);
    }
  }
  return (
    <section className="tool-page">
      <span className="travel-eyebrow">A LITTLE LESS LOST IN TRANSLATION</span>
      <h1>Words that travel with you.</h1>
      <p>
        Translate on your device when your browser and language pair support it.
        No paid API, and no promise of universal coverage.
      </p>
      <div className="translate-card">
        <div className="tool-fields">
          <label>
            From
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {languages.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {languages.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-field">
          Original text
          <textarea
            aria-label="Text to translate"
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            placeholder="A question, a direction, a small hello…"
          />
        </label>
        <div className="tool-actions">
          <small>{text.length}/2,000 characters</small>
          <button
            className="travel-button primary"
            disabled={busy}
            onClick={() => void translate()}
          >
            {busy ? "Translating…" : "Translate"}
          </button>
        </div>
        {status && (
          <p className="travel-notice" role="status">
            {status}
          </p>
        )}
        {result && (
          <div className="translation-result">
            <span>Translation</span>
            <p>{result}</p>
            <button
              className="travel-button secondary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(result)
                  .then(() => setStatus("Translation copied."))
                  .catch(() =>
                    setStatus(
                      "Copy is unavailable. Select the translation to copy it.",
                    ),
                  )
              }
            >
              Copy text
            </button>
          </div>
        )}
      </div>
      <p className="muted">
        Desktop Chrome support varies by language and model availability.
        Mobile, Firefox and Safari may not support this feature. Preserve the
        original and use a qualified interpreter for critical instructions.
      </p>
    </section>
  );
}
