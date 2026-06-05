const audio = document.querySelector("#audio");
const songList = document.querySelector("#songList");
const statusEl = document.querySelector("#status");
const searchInput = document.querySelector("#searchInput");
const playlistCardsEl = document.querySelector("#playlistCards");

const PLAYLISTS = [
  {
    id: "jay",
    source: "./playlist_with_covers.json",
    fallbackSources: ["./playlist_all.json", "./playlist.json"],
    fallbackName: "周杰伦收藏歌曲",
    fallbackCover: "./assets/default-cover.svg",
  },
  {
    id: "second",
    source: "./playlist2.json",
    fallbackSources: [],
    fallbackName: "我的第二个歌单",
    fallbackCover: "./assets/default-cover.svg",
  },
];

let activePlaylistId = PLAYLISTS[0].id;
let activePlaylistSource = PLAYLISTS[0].source;
let playlist = [];
let playlistInfo = {};
let currentIndex = 0;
let isLoopList = true;
let isShuffle = false;
let isSingleLoop = false;
let searchQuery = "";
let lastAudibleVolume = 0.8;

const $ = (id) => document.querySelector(id);
const VOLUME_ICONS = {
  muted: {
    label: "Volume muted",
    paths: [
      "M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8z",
      "M14.53 5.47a.75.75 0 0 1 0 1.06L13.06 8l1.47 1.47a.75.75 0 0 1-1.06 1.06L12 9.06l-1.47 1.47a.75.75 0 0 1-1.06-1.06L10.94 8 9.47 6.53a.75.75 0 0 1 1.06-1.06L12 6.94l1.47-1.47a.75.75 0 0 1 1.06 0z",
    ],
  },
  low: {
    label: "Volume low",
    paths: [
      "M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88",
    ],
  },
  mid: {
    label: "Volume medium",
    paths: [
      "M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 6.087a4.502 4.502 0 0 0 0-8.474v1.65a3 3 0 0 1 0 5.175z",
    ],
  },
  high: {
    label: "Volume high",
    paths: [
      "M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88",
      "M11.5 13.614a5.752 5.752 0 0 0 0-11.228v1.55a4.252 4.252 0 0 1 0 8.127z",
    ],
  },
};

function setRangeProgress(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value || 0);
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
  input.style.setProperty("--range-progress", `${Math.max(0, Math.min(100, percent))}%`);
}

function updateVolumeUi() {
  const volume = $("#volume");
  const volumeWrap = document.querySelector(".volume");
  const value = Number(volume.value || 0);
  const state = value <= 0 ? "muted" : value <= 0.35 ? "low" : value <= 0.6 ? "mid" : "high";
  const icon = VOLUME_ICONS[state];
  const svg = $("#volumeIcon");
  volumeWrap.dataset.volumeState = state;
  svg.setAttribute("aria-label", icon.label);
  svg.innerHTML = icon.paths.map(path => `<path d="${path}"></path>`).join("");
  volume.classList.toggle("muted", state === "muted");
  setRangeProgress(volume);
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmt(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getPlaylistConfig(id = activePlaylistId) {
  return PLAYLISTS.find(item => item.id === id) || PLAYLISTS[0];
}

async function fetchJson(source) {
  const res = await fetch(source, { cache: "no-store" });
  if (!res.ok) throw new Error(`${source} 加载失败`);
  return res.json();
}

async function fetchPlaylist(config = getPlaylistConfig()) {
  let lastError;
  for (const source of [config.source, ...config.fallbackSources]) {
    try {
      const data = await fetchJson(source);
      return { data, source };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("歌单加载失败");
}

async function buildPlaylistCards() {
  const cards = await Promise.all(PLAYLISTS.map(async (config) => {
    try {
      const data = await fetchJson(config.source);
      const info = data.playlist || {};
      return {
        ...config,
        name: info.name || config.fallbackName,
        cover: info.cover || data.tracks?.[0]?.cover || config.fallbackCover,
        count: data.tracks?.length || 0,
      };
    } catch {
      return {
        ...config,
        name: config.fallbackName,
        cover: config.fallbackCover,
        count: 0,
      };
    }
  }));

  playlistCardsEl.innerHTML = cards.map(card => `
    <button class="playlist-card ${card.id === activePlaylistId ? "active" : ""}" type="button" data-playlist-id="${card.id}">
      <img src="${esc(card.cover)}" alt="${esc(card.name)} 封面">
      <span class="playlist-card-copy">
        <strong>${esc(card.name)}</strong>
        <small>歌单 · ${card.count} 首歌曲</small>
      </span>
    </button>
  `).join("");

  playlistCardsEl.querySelectorAll("[data-playlist-id]").forEach(card => {
    card.addEventListener("click", () => {
      loadPlaylist(card.dataset.playlistId);
    });
  });
}

function updatePlaylistCardsActive() {
  playlistCardsEl.querySelectorAll("[data-playlist-id]").forEach(card => {
    card.classList.toggle("active", card.dataset.playlistId === activePlaylistId);
  });
}

async function loadPlaylist(id = activePlaylistId) {
  const config = getPlaylistConfig(id);
  activePlaylistId = config.id;
  activePlaylistSource = config.source;
  updatePlaylistCardsActive();
  statusEl.textContent = "正在加载歌单...";

  try {
    const { data, source } = await fetchPlaylist(config);

    playlistInfo = data.playlist || {};
    playlist = data.tracks || [];
    currentIndex = 0;
    searchQuery = "";
    searchInput.value = "";
    activePlaylistSource = source;

    $("#playlistName").textContent = playlistInfo.name || config.fallbackName;
    $("#playlistCover").src = playlistInfo.cover || playlist[0]?.cover || config.fallbackCover;
    $("#playlistMeta").textContent = `${playlist.length} 首歌曲 · ${source.replace("./", "")}`;
    $("#playlistSource").textContent = source.replace("./", "");
    $("#sideTrackCount").textContent = playlist.length;

    resetNowPlaying();
    renderList();
    await buildPlaylistCards();
    statusEl.textContent = "歌单加载成功";
  } catch (e) {
    console.error(e);
    playlist = [];
    renderList();
    statusEl.textContent = "加载失败，请检查歌单 JSON 或本地服务";
  }
}

function resetNowPlaying() {
  audio.pause();
  audio.removeAttribute("src");
  $("#duration").textContent = "0:00";
  $("#currentTime").textContent = "0:00";
  $("#progress").value = 0;
  setRangeProgress($("#progress"));
  updatePlayButtons(false);

  const cover = playlistInfo.cover || playlist[0]?.cover || "./assets/default-cover.svg";
  $("#nowTitle").textContent = "未播放";
  $("#nowCover").src = cover;
  $("#nowSong").textContent = "请选择歌曲";
  $("#nowArtist").textContent = "-";
  $("#nowAlbum").textContent = "-";
  $("#bottomCover").src = cover;
  $("#bottomTitle").textContent = "未播放";
  $("#bottomArtist").textContent = "请选择歌曲";
  $("#miniCover").src = cover;
  $("#miniTitle").textContent = "未播放";
  $("#miniArtist").textContent = "请选择歌曲";
}

function renderList() {
  songList.innerHTML = "";
  const query = searchQuery.trim().toLowerCase();
  const filtered = playlist
    .map((song, index) => ({ song, index }))
    .filter(({ song }) => {
      if (!query) return true;
      return [song.title, song.artist, song.album]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    });

  filtered.forEach(({ song, index }) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td class="title">${song.title || "未知标题"}</td>
      <td>${song.artist || "未知艺人"}</td>
      <td>${song.album || "未知专辑"}</td>
      <td>${song.duration ? fmt(song.duration) : "读取中"}</td>
    `;
    tr.addEventListener("click", () => playSong(index));
    songList.appendChild(tr);
  });

  if (!playlist.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="empty-row">这个歌单还没有歌曲</td>`;
    songList.appendChild(tr);
  } else if (query && !filtered.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="empty-row">没有找到匹配的歌曲</td>`;
    songList.appendChild(tr);
  }

  updateSearchStatus(filtered.length);
  updateActiveRow();
}

function updateSearchStatus(count) {
  if (!searchQuery.trim()) return;
  statusEl.textContent = `找到 ${count} 首匹配歌曲`;
}

function updateActiveRow() {
  document.querySelectorAll("#songList tr").forEach(row => {
    row.classList.toggle("active", Number(row.dataset.index) === currentIndex);
  });
}

function updateSongInfo(song) {
  const cover = song.cover || playlistInfo.cover || "./assets/default-cover.svg";
  $("#nowTitle").textContent = "正在播放";
  $("#nowCover").src = cover;
  $("#nowSong").textContent = song.title || "未知标题";
  $("#nowArtist").textContent = song.artist || "未知艺人";
  $("#nowAlbum").textContent = song.album || "未知专辑";

  $("#bottomCover").src = cover;
  $("#bottomTitle").textContent = song.title || "未知标题";
  $("#bottomArtist").textContent = song.artist || "未知艺人";

  $("#miniCover").src = cover;
  $("#miniTitle").textContent = song.title || "未知标题";
  $("#miniArtist").textContent = song.artist || "未知艺人";
}

async function playSong(index = currentIndex) {
  if (!playlist.length) return;
  currentIndex = (index + playlist.length) % playlist.length;
  const song = playlist[currentIndex];

  audio.src = song.url;
  updateSongInfo(song);
  updateActiveRow();

  try {
    await audio.play();
    updatePlayButtons(true);
  } catch (e) {
    console.error(e);
    statusEl.textContent = "浏览器阻止自动播放，请手动点击播放按钮";
  }
}

function updatePlayButtons(isPlaying) {
  const playPath = "M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288z";
  const pausePath = "M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7z";
  $("#playBtn .play-icon path").setAttribute("d", isPlaying ? pausePath : playPath);
  $("#playBtn").setAttribute("aria-label", isPlaying ? "暂停" : "播放");
  $("#playAllBtn").textContent = isPlaying ? "⏸" : "▶";
}

function togglePlay() {
  if (!audio.src) return playSong(currentIndex);
  if (audio.paused) {
    audio.play();
    updatePlayButtons(true);
  } else {
    audio.pause();
    updatePlayButtons(false);
  }
}

function nextSong() {
  if (!playlist.length) return;
  if (isShuffle) {
    currentIndex = Math.floor(Math.random() * playlist.length);
  } else {
    currentIndex++;
    if (currentIndex >= playlist.length) {
      if (!isLoopList) {
        currentIndex = playlist.length - 1;
        updatePlayButtons(false);
        return;
      }
      currentIndex = 0;
    }
  }
  playSong(currentIndex);
}

function prevSong() {
  playSong(currentIndex - 1);
}

function currentModeLabel() {
  if (isSingleLoop) return "单曲";
  if (isShuffle) return "随机";
  return isLoopList ? "循环" : "单次";
}

function updateModeLabels() {
  const playMode = isSingleLoop ? "单曲循环" : (isShuffle ? "随机播放" : "顺序");
  $("#playModeBtn").textContent = `播放模式：${playMode}`;
  $("#sideMode").textContent = currentModeLabel();
}

function setPlayMode(mode) {
  isShuffle = mode === "shuffle";
  isSingleLoop = mode === "single";
  updateModeLabels();
}

audio.addEventListener("loadedmetadata", () => {
  $("#duration").textContent = fmt(audio.duration);
  if (playlist[currentIndex] && !playlist[currentIndex].duration) {
    playlist[currentIndex].duration = audio.duration;
    renderList();
    updateActiveRow();
  }
});

audio.addEventListener("timeupdate", () => {
  $("#currentTime").textContent = fmt(audio.currentTime);
  $("#progress").value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  setRangeProgress($("#progress"));
});

audio.addEventListener("ended", () => {
  if (isSingleLoop) {
    playSong(currentIndex);
    return;
  }
  nextSong();
});

$("#progress").addEventListener("input", (e) => {
  if (audio.duration) {
    audio.currentTime = (Number(e.target.value) / 100) * audio.duration;
  }
  setRangeProgress(e.target);
});

$("#volume").addEventListener("input", (e) => {
  const value = Number(e.target.value);
  audio.volume = value;
  if (value > 0) lastAudibleVolume = value;
  updateVolumeUi();
});

function setVolume(value) {
  const volume = $("#volume");
  const next = Math.max(0, Math.min(1, value));
  audio.volume = next;
  volume.value = next.toFixed(2);
  if (next > 0) lastAudibleVolume = next;
  updateVolumeUi();
}

$("#muteBtn").addEventListener("click", () => {
  if (audio.volume > 0) {
    setVolume(0);
  } else {
    setVolume(lastAudibleVolume || 0.8);
  }
});

$("#fullscreenBtn").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (error) {
    console.error(error);
  }
});

$("#playBtn").addEventListener("click", togglePlay);
$("#playAllBtn").addEventListener("click", togglePlay);
$("#nextBtn").addEventListener("click", nextSong);
$("#prevBtn").addEventListener("click", prevSong);
$("#loadBtn").addEventListener("click", () => loadPlaylist(activePlaylistId));

searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderList();
  if (!searchQuery.trim()) {
    statusEl.textContent = playlist.length ? "歌单加载成功" : "";
  }
});

$("#loopBtn").addEventListener("click", () => {
  isLoopList = !isLoopList;
  $("#loopBtn").textContent = isLoopList ? "列表循环：开" : "列表循环：关";
  updateModeLabels();
});

document.querySelectorAll("[data-play-mode]").forEach(button => {
  button.addEventListener("click", () => {
    setPlayMode(button.dataset.playMode);
    document.activeElement?.blur();
  });
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
  if (e.code === "ArrowRight") nextSong();
  if (e.code === "ArrowLeft") prevSong();
});

audio.volume = 0.8;
$("#volume").value = audio.volume;
updateVolumeUi();
setRangeProgress($("#progress"));
updateModeLabels();
buildPlaylistCards();
loadPlaylist();
