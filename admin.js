// ----- Local DB 초기화 -----
if (!window.LocalDB) {
  console.error("[소방 QR관리] localdb.js 로드가 필요합니다.");
}

// 출석 세션 및 통계 관리
let sessionsCache = [];
let currentSessionForChart = null;
let deptChart = null;
let deptChartModal = null;

// ----- Toast -----
function showToast(message, type = "default") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  container.innerHTML = "";
  const toast = document.createElement("div");
  toast.className = "toast";

  let emoji = "ℹ️";
  if (type === "success") emoji = "✅";
  else if (type === "error") emoji = "⚠️";

  toast.textContent = `${emoji} ${message}`;
  container.appendChild(toast);
  container.classList.remove("hidden");

  setTimeout(() => {
    container.classList.add("hidden");
  }, 2500);
}

// ----- 모달 공통 -----
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

document.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  const closeId = target.getAttribute("data-close-modal");
  if (closeId) {
    closeModal(closeId);
  }
});

// ----- Local DB helpers -----
async function fetchSessions() {
  try {
    return window.LocalDB ? window.LocalDB.listSessions({ days: 14 }) : [];
  } catch (e) {
    console.error(e);
    showToast("세션 목록을 불러오지 못했습니다.", "error");
    return [];
  }
}

async function fetchAttendances(sessionId) {
  try {
    return window.LocalDB ? window.LocalDB.listAttendances(sessionId) : [];
  } catch (e) {
    console.error(e);
    showToast("출석 명단을 불러오지 못했습니다.", "error");
    return [];
  }
}

async function fetchDeptStats(sessionId) {
  try {
    return window.LocalDB ? window.LocalDB.deptStats(sessionId) : [];
  } catch (e) {
    console.error(e);
    showToast("부서 통계를 불러오지 못했습니다.", "error");
    return [];
  }
}

async function createSession({ date, title, note }) {
  try {
    if (!window.LocalDB) return null;
    return window.LocalDB.createSession({ date, title, note });
  } catch (e) {
    console.error(e);
    showToast("세션 생성에 실패했습니다.", "error");
    return null;
  }
}

// ----- UI 렌더링 -----
function formatDateKorean(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${y}.${String(m).padStart(2, "0")}.${String(day).padStart(
    2,
    "0"
  )} (${w})`;
}

function formatTimeHHMM(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildQrUrl(sessionId) {
  console.log("[QR][buildQrUrl] start", {
    sessionId,
    origin: window.location.origin,
    pathname: window.location.pathname,
  });
  const base = `${window.location.origin}${window.location.pathname}`;
  // index.html -> qrcheck.html
  const qrPage = base.replace(/index\.html?$/i, "qrcheck.html");
  const url = qrPage.includes("qrcheck.html")
    ? qrPage
    : `${window.location.origin}/qrcheck.html`;
  const finalUrl = `${url}?session=${encodeURIComponent(sessionId)}`;
  console.log("[QR][buildQrUrl] result", { base, qrPage, url, finalUrl });
  return finalUrl;
}

function buildQrImageSrc(qrUrl) {
  console.log("[QR][buildQrImageSrc]", { qrUrl });
  const encoded = encodeURIComponent(qrUrl);
  // QR 이미지 생성은 외부 서비스 의존.
  // 일부 환경(광고차단/사내망)에서 google chart가 막히는 경우가 있어
  // 기본은 qrserver를 사용하고, 실패 시 google로 폴백한다.
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encoded}`;
}

function renderSessions() {
  const container = document.getElementById("session-list");
  if (!container) return;

  if (!sessionsCache.length) {
    container.innerHTML =
      '<div class="qr-box-placeholder" style="padding: 16px;">아직 등록된 교육 세션이 없습니다. 우측에서 새 세션을 생성하세요.</div>';
    return;
  }

  container.innerHTML = "";
  sessionsCache.forEach((s) => {
    const item = document.createElement("div");
    item.className = "session-item";
    item.innerHTML = `
      <div class="session-item-main">
        <div class="session-title">${s.title}</div>
        <div class="session-meta">
          <span>${formatDateKorean(s.date)}</span>
          ${
            s.note
              ? `<span style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.note}</span>`
              : ""
          }
        </div>
      </div>
      <div class="session-actions">
        <div class="session-count">총 ${s.attendance_count}명</div>
        <div class="flex gap-8">
          <button class="btn-ghost btn-sm" data-action="view-qr" data-id="${
            s.id
          }">QR</button>
          <button class="btn-ghost btn-sm" data-action="view-att" data-id="${
            s.id
          }">출석 상세</button>
          <button class="btn-ghost btn-sm" data-action="view-chart" data-id="${
            s.id
          }">통계</button>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

function attachSessionListEvents() {
  const container = document.getElementById("session-list");
  if (!container) return;

  container.addEventListener("click", async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const id = target.getAttribute("data-id");
    const action = target.getAttribute("data-action");
    if (!id || !action) return;

    const session = sessionsCache.find((s) => s.id === id);
    if (!session) return;

    if (action === "view-qr") {
      showQrForSession(session);
    } else if (action === "view-att") {
      await openAttendanceModal(session);
    } else if (action === "view-chart") {
      await updateDeptStatsForSession(session, { openModal: false });
    }
  });
}

function showQrForSession(session) {
  const titleEl = document.getElementById("qr-session-title");
  const placeholder = document.getElementById("qr-placeholder");
  const content = document.getElementById("qr-content");
  const img = document.getElementById("qr-image");
  const urlEl = document.getElementById("qr-url");

  if (!titleEl || !placeholder || !content || !img || !urlEl) return;

  const url = buildQrUrl(session.id);
  console.log("[QR][showQrForSession]", {
    sessionId: session.id,
    sessionTitle: session.title,
    qrUrl: url,
  });
  titleEl.textContent = `${formatDateKorean(session.date)} · ${session.title}`;
  placeholder.classList.add("hidden");
  content.classList.remove("hidden");
  const imgSrc = buildQrImageSrc(url);
  console.log("[QR][showQrForSession] image src", { imgSrc });
  // 외부 QR 서비스가 막혔을 때 폴백 처리
  img.onerror = () => {
    const encoded = encodeURIComponent(url);
    const fallback = `https://chart.googleapis.com/chart?cht=qr&chs=260x260&chl=${encoded}`;
    console.warn("[QR][showQrForSession] image load failed. fallback", {
      primary: imgSrc,
      fallback,
    });
    img.onerror = null; // 무한 루프 방지
    img.src = fallback;
  };
  img.src = imgSrc;
  urlEl.textContent = url;

  const copyBtn = document.getElementById("copy-qr-url");
  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        console.log("[QR][copy-qr-url] copy attempt", { url });
        await navigator.clipboard.writeText(url);
        showToast("출석 URL이 복사되었습니다.", "success");
      } catch (err) {
        console.error(err);
        showToast("클립보드 복사에 실패했습니다.", "error");
      }
    };
  }
}

async function openAttendanceModal(session) {
  const tbody = document.getElementById("attendance-modal-body");
  const sessionInfo = document.getElementById("attendance-modal-session");
  if (!tbody || !sessionInfo) return;

  tbody.innerHTML = '<tr><td colspan="3">불러오는 중...</td></tr>';
  sessionInfo.textContent = `${formatDateKorean(session.date)} · ${
    session.title
  }`;
  openModal("attendance-modal");

  const records = await fetchAttendances(session.id);
  if (!records.length) {
    tbody.innerHTML =
      '<tr><td colspan="3" class="text-muted">등록된 출석이 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  records.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${r.department || "-"}</td>
      <td>${formatTimeHHMM(r.created_at)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDeptChart(targetCanvas, stats) {
  if (!targetCanvas) return;
  const labels = stats.map((s) => s.department || "미지정");
  const counts = stats.map((s) => s.count || 0);

  const data = {
    labels,
    datasets: [
      {
        label: "출석 인원",
        data: counts,
        backgroundColor: "rgba(211, 47, 47, 0.8)",
        borderRadius: 6,
        maxBarThickness: 40,
      },
    ],
  };

  if (targetCanvas.id === "dept-chart") {
    if (deptChart) {
      deptChart.data = data;
      deptChart.update();
      return;
    }
    deptChart = new Chart(targetCanvas, {
      type: "bar",
      data,
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  } else {
    if (deptChartModal) {
      deptChartModal.data = data;
      deptChartModal.update();
      return;
    }
    deptChartModal = new Chart(targetCanvas, {
      type: "bar",
      data,
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }
}

async function updateDeptStatsForSession(session, { openModal = true } = {}) {
  const label = document.getElementById("chart-session-label");
  const modalLabel = document.getElementById("chart-modal-session-label");

  if (label) {
    label.textContent = `${formatDateKorean(session.date)} · ${
      session.title
    } 부서별 출석 현황`;
  }
  if (modalLabel) {
    modalLabel.textContent = `${formatDateKorean(session.date)} · ${
      session.title
    }`;
  }

  currentSessionForChart = session;

  const stats = await fetchDeptStats(session.id);
  const canvas = document.getElementById("dept-chart");
  const canvasModal = document.getElementById("dept-chart-modal");
  renderDeptChart(canvas, stats);
  renderDeptChart(canvasModal, stats);

  if (openModal) {
    openModalFn();
  }

  function openModalFn() {
    openModal("chart-modal");
  }
}

// ----- 실시간 출석 구독 -----
function subscribeRealtimeAttendance() {
  // 다른 탭/창에서 출석이 등록되면 자동으로 갱신
  const onDbUpdated = async (payload) => {
    const sessionId = payload && payload.session_id ? payload.session_id : null;
    await loadSessions();
    if (
      currentSessionForChart &&
      sessionId &&
      currentSessionForChart.id === sessionId
    ) {
      updateDeptStatsForSession(currentSessionForChart, { openModal: false });
    }
  };

  // 1) BroadcastChannel (지원 브라우저)
  let bc = null;
  if ("BroadcastChannel" in window) {
    bc = new BroadcastChannel("FIRE_QR_CHANNEL_V1");
    bc.onmessage = (ev) => {
      if (ev && ev.data && ev.data.type === "DB_UPDATED") {
        console.log("[LOCAL][realtime] BroadcastChannel update", ev.data);
        onDbUpdated(ev.data.payload);
      }
    };
  }

  // 2) storage 이벤트 (다른 탭에서 localStorage 변경 시)
  window.addEventListener("storage", (ev) => {
    if (ev.key === (window.LocalDB && window.LocalDB._KEY)) {
      console.log("[LOCAL][realtime] storage update");
      onDbUpdated(null);
    }
  });

  return { bc };
}

// ----- 초기화 -----
async function initAdmin() {
  attachSessionListEvents();

  const refreshButton = document.getElementById("refresh-all");
  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      await loadSessions();
      showToast("세션 목록을 새로고침했습니다.", "success");
    });
  }

  const chartModalBtn = document.getElementById("open-chart-modal");
  if (chartModalBtn) {
    chartModalBtn.addEventListener("click", () => {
      if (currentSessionForChart) {
        openModal("chart-modal");
      } else {
        showToast("먼저 세션을 선택해 주세요.", "default");
      }
    });
  }

  const form = document.getElementById("create-session-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const dateEl = document.getElementById("session-date");
      const titleEl = document.getElementById("session-title");
      const noteEl = document.getElementById("session-note");
      if (!dateEl || !titleEl || !noteEl) return;

      const date = dateEl.value;
      const title = titleEl.value.trim();
      const note = noteEl.value.trim();

      if (!date || !title) {
        showToast("교육 일자와 교육명을 입력해 주세요.", "error");
        return;
      }

      const newSession = await createSession({ date, title, note });
      if (!newSession) return;

      showToast("새 교육 세션이 생성되었습니다.", "success");
      // 목록에 추가하고 정렬
      sessionsCache = [newSession, ...sessionsCache];
      sessionsCache.sort((a, b) => (a.date < b.date ? 1 : -1));
      renderSessions();

      // 폼 초기화
      titleEl.value = "";
      noteEl.value = "";

      // QR 표시
      showQrForSession(newSession);
    });
  }

  // 오늘 날짜 기본값
  const dateEl = document.getElementById("session-date");
  if (dateEl) {
    const today = new Date().toISOString().slice(0, 10);
    dateEl.value = today;
  }

  await loadSessions();
  subscribeRealtimeAttendance();
}

async function loadSessions() {
  sessionsCache = await fetchSessions();
  renderSessions();
}

document.addEventListener("DOMContentLoaded", () => {
  initAdmin();
});

