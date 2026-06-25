// src/mathEngine.js

let mathJaxLoadPromise = null;

function ensureMathJaxLoaded() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.MathJax?.typesetPromise) {
    return Promise.resolve();
  }
  if (mathJaxLoadPromise) {
    return mathJaxLoadPromise;
  }

  mathJaxLoadPromise = new Promise((resolve, reject) => {
    window.MathJax = {
      tex: {
        inlineMath: [["$", "$"], ["\\(", "\\)"]],
        displayMath: [["$$", "$$"], ["\\[", "\\]"]],
      },
      options: {
        skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      },
    };

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
    script.async = true;
    script.id = "MathJax-script";
    script.onload = () => resolve();
    script.onerror = () => {
      mathJaxLoadPromise = null;
      reject(new Error("MathJax failed to load"));
    };
    document.head.appendChild(script);
  });

  return mathJaxLoadPromise;
}

// ====== Dynamic Math Typesetting Trigger ======
export function triggerMathTypeset(scope) {
  const scopedElements = scope ? (Array.isArray(scope) ? scope : [scope]) : null;

  const runTypeset = () => {
    try {
      if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise(scopedElements || undefined).catch((err) =>
          console.warn("MathJax typesetPromise failed:", err)
        );
      } else if (window.MathJax?.Hub?.Queue) {
        if (scopedElements?.length) {
          window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, scopedElements]);
        } else {
          window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
        }
      } else if (typeof window.renderMathInElement === "function") {
        const target = scopedElements?.[0] || document.body;
        window.renderMathInElement(target, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
          ],
          throwOnError: false,
        });
      }
    } catch (err) {
      console.warn("Math typesetting call bypassed or failed:", err);
    }
  };

  ensureMathJaxLoaded()
    .then(() => {
      runTypeset();
      setTimeout(runTypeset, 60);
    })
    .catch((err) => console.warn("MathJax load skipped:", err));
}
