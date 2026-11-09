// Operator shortcuts, with FreeShow's controller bindings.
//
// Loaded in the page, not bound to an element: an operator must not have to
// click the window first, and focus can sit on any button. The page sends the
// key name; Rust maps it to a command (crates/core/src/input.rs), so the
// binding table lives in one tested place and this file only captures keys.
(() => {
    const bindings = new Set([" ", "ArrowRight", "PageDown", "ArrowLeft", "PageUp", "Escape"]);

    document.addEventListener("keydown", (event) => {
        const target = event.target;
        // Never steal a key while someone is typing.
        if (target && target.closest && target.closest("input, textarea, select, [contenteditable]")) return;

        // Ctrl+1..8 select drawer tabs. The page sends the chord; Rust owns the
        // tab order and the "open to at least 300 px" behaviour.
        if ((event.ctrlKey || event.metaKey) && !event.altKey && /^[1-8]$/.test(event.key)) {
            event.preventDefault();
            dioxus.send("Ctrl+" + event.key);
            return;
        }

        if (!bindings.has(event.key)) return;
        // Space and PageDown would otherwise scroll or press a focused button.
        event.preventDefault();
        dioxus.send(event.key);
    });
})();
