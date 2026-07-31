(() => {
  "use strict";

  document.querySelectorAll("body > .about-player").forEach((player) => player.remove());

  const pagePlayer = document.querySelector(".page-template-content .about-player");

  if (!pagePlayer) {
    return;
  }

  if (pagePlayer.dataset.playerReady === "true") return;
  pagePlayer.dataset.playerReady = "true";

  const audio = pagePlayer.querySelector("audio");
  const toggle = pagePlayer.querySelector(".about-player__toggle");
  const icon = toggle?.querySelector("i");
  const progress = pagePlayer.querySelector(".about-player__timeline span");
  const status = pagePlayer.querySelector(".about-player__status");
  const trackTitle = pagePlayer.dataset.trackTitle || "当前曲目";

  if (!audio || !toggle || !icon || !progress || !status) return;

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return "--:--";
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  };

  const showUnavailable = () => {
    audio.pause();
    toggle.disabled = true;
    toggle.setAttribute("aria-label", "占位音源不可播放");
    icon.className = "fa-solid fa-music";
    status.textContent = "占位音源不可播放";
    progress.style.width = "0%";
  };

  const showPaused = () => {
    icon.className = "fa-solid fa-play";
    toggle.setAttribute("aria-label", `播放 ${trackTitle}`);
  };

  const showPlaying = () => {
    icon.className = "fa-solid fa-pause";
    toggle.setAttribute("aria-label", `暂停 ${trackTitle}`);
  };

  audio.addEventListener("loadedmetadata", () => {
    status.textContent = `0:00 / ${formatTime(audio.duration)}`;
  });

  audio.addEventListener("timeupdate", () => {
    const ratio = audio.duration ? audio.currentTime / audio.duration : 0;
    progress.style.width = `${Math.min(Math.max(ratio * 100, 0), 100)}%`;
    status.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  });

  audio.addEventListener("play", showPlaying);
  audio.addEventListener("pause", showPaused);
  audio.addEventListener("ended", showPaused);
  audio.addEventListener("error", showUnavailable, { once: true });

  toggle.addEventListener("click", async () => {
    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
    } catch {
      showUnavailable();
    }
  });

  if (audio.error) {
    showUnavailable();
  } else {
    showPaused();
  }
})();
