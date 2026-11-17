// 電腦:影片貼進螢幕(四邊形 clip-path)。影片存 IndexedDB,首頁與子頁各有一個 <video>,共用同一個 object URL。
// 規則:mp4 / mov / webm,時長 ≤ 10 秒;靜音、循環、不顯示控制列。
(function () {
  const L = RL.LAPTOP;
  const KEY = 'laptop-video';
  const S = { url: null, paused: false, videos: [], spaces: [], hubVideo: null, pageVideo: null };
  const lapHotspot = () => RL.HOTSPOTS.find(h => h.id === 'laptop');
  const pct = (v, total) => (v / total * 100).toFixed(4) + '%';
  const hintText = () => !S.url ? '上傳影片' : S.paused ? '▶ 播放' : '⏸ 暫停';

  // 影片鋪在螢幕開口的外接矩形;上面再蓋一張「螢幕處挖空」的框架圖,邊緣就和原圖完全貼合
  const [sx, sy, sw, sh] = L.hole;

  RL.objects.laptop = {
    mount(el, { editable }) {
      el.classList.add('obj', 'obj-laptop'); if (!editable) el.classList.add('ro');
      el.innerHTML = '<img class="obj-img" src="assets/objects/laptop.png" alt="" draggable="false">' +
        `<div class="screen" style="left:${pct(sx, L.w)};top:${pct(sy, L.h)};width:${pct(sw, L.w)};height:${pct(sh, L.h)}">` +
        '<video muted loop playsinline preload="auto" disablepictureinpicture disableremoteplayback tabindex="-1" hidden></video>' +
        (editable ? '<span class="screen-empty">尚未上傳影片</span>' : '') + '</div>' +
        '<img class="obj-img frame" src="assets/objects/laptop-frame.png" alt="" draggable="false">';
      const v = el.querySelector('video'); v.muted = true; v.defaultMuted = true; v.controls = false;
      S.videos.push(v); if (editable) S.pageVideo = v; else S.hubVideo = v;
      if (editable) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'space-hit'; b.setAttribute('aria-label', '空白鍵:暫停或播放影片');
        const sp = L.space; b.style.cssText = `left:${pct(sp[0], L.w)};top:${pct(sp[1], L.h)};width:${pct(sp[2], L.w)};height:${pct(sp[3], L.h)}`;
        b.addEventListener('click', () => { if (S.url) toggle(); });
        el.appendChild(b); S.spaces.push(b);
      }
      render();
      return { video: v };
    }
  };

  function playState() { S.videos.forEach(v => { if (!v.src) return; if (S.paused) v.pause(); else { const p = v.play(); p && p.catch(() => {}); } }); }
  function render() {
    S.videos.forEach(v => {
      if (S.url) { if (v.getAttribute('src') !== S.url) v.src = S.url; v.hidden = false; }
      else { v.pause(); if (v.hasAttribute('src')) { v.removeAttribute('src'); v.load(); } v.hidden = true; }
    });
    document.querySelectorAll('.screen-empty').forEach(e => { e.hidden = !!S.url; });
    const hs = document.getElementById('hs-laptop-space');
    const t = hintText();
    if (hs) hs.dataset.hint = t;
    S.spaces.forEach(b => { b.dataset.hint = S.url ? t : '請先上傳影片'; });
    playState(); controlsState();
  }
  function toggle() { S.paused = !S.paused; render(); }
  RL.actions.laptopSpace = () => { if (S.url) toggle(); else RL.navigate(lapHotspot()); };   // 尚無影片:點空白鍵也進編輯頁

  // ── 子頁控制列 ──
  const page = document.getElementById('page-laptop');
  const input = document.getElementById('laptop-file');
  const pickLabel = document.getElementById('laptop-pick-label');
  const removeBtn = document.getElementById('laptop-remove');
  const note = document.getElementById('laptop-note');
  const setNote = t => { note.textContent = t || ''; };
  function controlsState() { pickLabel.textContent = S.url ? '更換影片' : '選擇影片'; removeBtn.disabled = !S.url; }

  function setVideo(blob) {
    if (S.url) URL.revokeObjectURL(S.url);
    S.url = blob ? URL.createObjectURL(blob) : null;
    S.paused = false;
    render();
  }
  // 讀取時長;失敗或超時回傳 null
  function probe(file) {
    return new Promise(resolve => {
      const u = URL.createObjectURL(file), v = document.createElement('video');
      let done = false;
      const fin = d => { if (done) return; done = true; clearTimeout(tm); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(u); resolve(d); };
      const tm = setTimeout(() => fin(null), 10000);
      v.preload = 'metadata'; v.muted = true;
      v.addEventListener('loadedmetadata', () => fin(v.duration));
      v.addEventListener('error', () => fin(null));
      v.src = u;
    });
  }
  const okType = f => /^video\/(mp4|quicktime|webm)$/.test(f.type) || /\.(mp4|mov|webm)$/i.test(f.name);

  input.addEventListener('change', async () => {
    const f = input.files && input.files[0]; input.value = '';
    if (!f) return;                                                    // 取消選檔:保留原影片
    if (!okType(f)) { setNote('只接受 mp4、mov、webm 影片檔。原影片沒有改變。'); return; }
    setNote('檢查影片中…');
    const d = await probe(f);
    if (d == null) { setNote('這個影片無法讀取(可能是瀏覽器不支援的格式)。請改用 mp4 或 webm。原影片沒有改變。'); return; }
    if (!isFinite(d)) { setNote('無法判斷影片長度,未更換。請改用其他檔案。'); return; }
    if (d > L.maxSeconds + 0.05) { setNote(`影片長度 ${d.toFixed(1)} 秒,超過 ${L.maxSeconds} 秒上限,未更換。`); return; }
    const saved = await RL.idb.put(KEY, f);
    setVideo(f);
    RL.store.update('laptop', s => { s.hasVideo = true; s.name = f.name; });
    setNote(saved || !RL.PERSIST ? `已更新影片(${d.toFixed(1)} 秒)。` : '影片已載入,但這個瀏覽器無法保存,重新載入後會消失。');
  });
  removeBtn.addEventListener('click', async () => {
    await RL.idb.del(KEY); setVideo(null);
    RL.store.update('laptop', s => { s.hasVideo = false; s.name = ''; });
    setNote('已移除影片。');
  });

  // 清除全部資料時(store 重設)同步釋放影片
  RL.store.subscribe('laptop', s => { if (!s.hasVideo && S.url) { setVideo(null); } });

  // 子頁掛上可編輯版本
  RL.objects.laptop.mount(document.getElementById('laptop-obj'), { editable: true });

  // 載入已保存的影片
  if (RL.store.get('laptop').hasVideo) {
    RL.idb.get(KEY).then(b => {
      if (b) setVideo(b);
      else RL.store.update('laptop', s => { s.hasVideo = false; s.name = ''; });   // 找不到檔案:回到沒有影片
    });
  }

  function syncTime(from, to) { try { if (isFinite(from.currentTime)) to.currentTime = from.currentTime; } catch (e) {} }
  RL.pages.laptop = {
    beforeEnter() { if (S.hubVideo && S.pageVideo && S.url) syncTime(S.hubVideo, S.pageVideo); },
    beforeExit() { if (S.hubVideo && S.pageVideo && S.url) syncTime(S.pageVideo, S.hubVideo); },
    afterEnter() { setNote(''); document.querySelector('#page-laptop .file-btn input').focus({ preventScroll: true }); }
  };
  // hub-layer 先於 hotspots 之外建立首頁版;兩者都掛好後同步一次提示文字
  window.addEventListener('load', render);
})();
