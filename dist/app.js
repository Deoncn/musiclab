const audio = document.querySelector("#audio");
const songList = document.querySelector("#songList");
const statusEl = document.querySelector("#status");

const PLAYLIST_SOURCES = [
  "./playlist_with_covers.json",
  "./playlist_all.json",
  "./playlist.json"
];

let playlist = [];
let playlistInfo = {};
let currentIndex = 0;
let isLoopList = true;
let isShuffle = false;

const $ = (id) => document.querySelector(id);

function fmt(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function fetchPlaylist() {
  let lastError;
  for (const source of PLAYLIST_SOURCES) {
    try {
      const res = await fetch(source, { cache: "no-store" });
      if (!res.ok) throw new Error(`${source} 加载失败`);
      const data = await res.json();
      return { data, source };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("歌单加载失败");
}

async function loadPlaylist() {
  statusEl.textContent = "正在加载歌单...";
  try {
    const { data, source } = await fetchPlaylist();

    playlistInfo = data.playlist || {};
    playlist = data.tracks || [];

    $("#playlistName").textContent = playlistInfo.name || "我的在线歌单";
    $("#playlistCover").src = playlistInfo.cover || playlist[0]?.cover || "./assets/default-cover.svg";
    $("#playlistMeta").textContent = `${playlist.length} 首歌曲 · ${source.replace("./", "")}`;
    $("#sideTrackCount").textContent = playlist.length;

    renderList();
    statusEl.textContent = "歌单加载成功";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "加载失败，请检查歌单 JSON 或本地服务";
  }
}

function renderList() {
  songList.innerHTML = "";
  playlist.forEach((song, index) => {
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
  $("#playBtn").textContent = isPlaying ? "⏸" : "▶";
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
});

audio.addEventListener("ended", nextSong);

$("#progress").addEventListener("input", (e) => {
  if (audio.duration) {
    audio.currentTime = (Number(e.target.value) / 100) * audio.duration;
  }
});

$("#volume").addEventListener("input", (e) => {
  audio.volume = Number(e.target.value);
});

$("#playBtn").addEventListener("click", togglePlay);
$("#playAllBtn").addEventListener("click", togglePlay);
$("#nextBtn").addEventListener("click", nextSong);
$("#prevBtn").addEventListener("click", prevSong);
$("#loadBtn").addEventListener("click", loadPlaylist);

$("#shuffleBtn").addEventListener("click", () => {
  isShuffle = !isShuffle;
  $("#shuffleBtn").textContent = isShuffle ? "随机：开" : "随机";
});

$("#loopBtn").addEventListener("click", () => {
  isLoopList = !isLoopList;
  $("#loopBtn").textContent = isLoopList ? "列表循环：开" : "列表循环：关";
  $("#sideMode").textContent = isLoopList ? "循环" : "单次";
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
loadPlaylist();
