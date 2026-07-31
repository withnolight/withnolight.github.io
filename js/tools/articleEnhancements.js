const copyText = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

const showButtonFeedback = (button, message) => {
  const originalTitle = button.getAttribute("title") || "";
  button.setAttribute("title", message);
  button.setAttribute("aria-label", message);
  button.classList.add("success");

  window.setTimeout(() => {
    button.setAttribute("title", originalTitle);
    button.setAttribute("aria-label", originalTitle);
    button.classList.remove("success");
  }, 1600);
};

export const initPostShare = ({ signal } = {}) => {
  const container = document.querySelector(".article-actions");
  if (!container) {
    return;
  }

  const title = container.dataset.shareTitle || document.title;
  const url = container.dataset.shareUrl || window.location.href;
  const copiedMessage = window.i18n?.link_copied || "Link copied";

  container.querySelectorAll(".post-share-action").forEach((button) => {
    const handler = async () => {
      try {
        if (button.dataset.shareService === "native" && navigator.share) {
          await navigator.share({ title, url });
          return;
        }

        await copyText(url);
        showButtonFeedback(button, copiedMessage);
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.warn("[redefine] Unable to share this post:", error);
        }
      }
    };

    button.addEventListener("click", handler, signal ? { signal } : undefined);
  });
};

export const initReadMode = ({ signal } = {}) => {
  const button = document.querySelector(".tool-read-mode");
  if (!button) {
    document.body.classList.remove("read-mode");
    return;
  }

  const icon = button.querySelector("i");
  const label = button.dataset.readModeLabel || "Read mode";
  const exitLabel = button.dataset.exitReadModeLabel || "Exit read mode";

  const setReadMode = (enabled) => {
    document.body.classList.toggle("read-mode", enabled);
    button.classList.toggle("active", enabled);
    button.setAttribute("title", enabled ? exitLabel : label);
    button.setAttribute("aria-label", enabled ? exitLabel : label);
    button.setAttribute("aria-pressed", String(enabled));
    if (icon) {
      icon.className = enabled
        ? "fa-regular fa-compress-wide"
        : "fa-regular fa-book-open-reader";
    }
  };

  setReadMode(false);

  const toggleHandler = () => {
    setReadMode(!document.body.classList.contains("read-mode"));
  };
  const keyHandler = (event) => {
    if (
      event.target === button &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      toggleHandler();
      return;
    }

    if (event.key === "Escape" && document.body.classList.contains("read-mode")) {
      setReadMode(false);
    }
  };

  button.addEventListener("click", toggleHandler, signal ? { signal } : undefined);
  document.addEventListener("keydown", keyHandler, signal ? { signal } : undefined);
};

export default function initArticleEnhancements(options = {}) {
  initPostShare(options);
  initReadMode(options);
}
