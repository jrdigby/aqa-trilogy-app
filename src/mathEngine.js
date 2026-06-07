// src/mathEngine.js

// ====== Dynamic Math Typesetting Trigger ======
// Added "export" so app.js can trigger this whenever a new question loads
export function triggerMathTypeset() {
  try {
    const runTypeset = () => {
      // 1. MathJax v3 (Modern standard)
      if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
        window.MathJax.typesetPromise().catch(err => console.warn("MathJax typesetPromise failed:", err));
      }
      // 2. MathJax v2 (Legacy standard)
      else if (window.MathJax && window.MathJax.Hub && typeof window.MathJax.Hub.Queue === "function") {
        window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
      }
      // 3. KaTeX with auto-render extension
      else if (typeof window.renderMathInElement === "function") {
        window.renderMathInElement(document.body, {
          delimiters: [
            {left: "$$", right: "$$", display: true},
            {left: "$", right: "$", display: false}
          ],
          throwOnError: false
        });
      }
    };
    runTypeset();
    setTimeout(runTypeset, 60); // Small deferred check to handle slow dynamic DOM paintings
  } catch (err) {
    console.warn("Math typesetting call bypassed or failed:", err);
  }
}

// ====== Bulletproof Dynamic MathJax Bootloader ======
// This runs automatically the moment app.js imports this file
(function loadMathJaxScript() {
  if (!window.MathJax) {
    console.log("APP: MathJax not found. Dynamically injecting KaTeX/MathJax configurations...");
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']]
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      }
    };
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
    script.async = true;
    script.id = "MathJax-script";
    script.onload = () => {
      console.log("APP: MathJax loaded successfully.");
      triggerMathTypeset();
    };
    document.head.appendChild(script);
  } else {
    setTimeout(triggerMathTypeset, 100);
  }
})();