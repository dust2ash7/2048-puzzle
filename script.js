(() => {
  const OrigAudio = window.Audio;
  window.Audio = function (src) {
    if (src && /music-bed/i.test(String(src))) {
      src = "https://opengameart.org/sites/default/files/HappyClappyLoop.wav";
    }
    return new OrigAudio(src);
  };
  window.Audio.prototype = OrigAudio.prototype;
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/gh/dust2ash7/2048-puzzle@3334884e6270af27cb15e5a2d19f19af547391d9/script.js";
  s.defer = true;
  document.head.appendChild(s);
})();
