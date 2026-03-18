// ----- Local DB 초기화 -----
if (!window.LocalDB) {
  console.error("[소방 QR출석] localdb.js 로드가 필요합니다.");
}

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

// ----- Helpers -----
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function fetchSession(sessionId) {
  console.log("[QRCHECK][fetchSession] start", { sessionId });
  try {
    const data = window.LocalDB ? window.LocalDB.getSession(sessionId) : null;
    console.log("[QRCHECK][fetchSession] result", data);
    return data;
  } catch (e) {
    console.error("[QRCHECK][fetchSession] error", e);
    return null;
  }
}

async function findDuplicateAttendance(sessionId, name, department) {
  console.log("[QRCHECK][findDuplicateAttendance] start", {
    sessionId,
    name,
    department,
  });
  try {
    const data = window.LocalDB
      ? window.LocalDB.findDuplicateAttendance(sessionId, name, department)
      : null;
    console.log("[QRCHECK][findDuplicateAttendance] result", data);
    return data;
  } catch (e) {
    console.error("[QRCHECK][findDuplicateAttendance] error", e);
    return null;
  }
}

async function insertAttendance(sessionId, name, department) {
  console.log("[QRCHECK][insertAttendance] start", {
    sessionId,
    name,
    department,
  });
  try {
    if (!window.LocalDB) return { ok: false, error: "NO_LOCALDB" };
    const res = window.LocalDB.insertAttendance(sessionId, name, department);
    console.log("[QRCHECK][insertAttendance] result", res);
    return res;
  } catch (e) {
    console.error("[QRCHECK][insertAttendance] error", e);
    return { ok: false, error: "EXCEPTION" };
  }
}

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

// ----- 초기화 -----
async function initQrCheck() {
  const infoEl = document.getElementById("session-info");
  const errorEl = document.getElementById("session-error");
  const form = document.getElementById("attendance-form");
  const successEl = document.getElementById("attendance-success");
  const dupEl = document.getElementById("attendance-dup");
  const errEl = document.getElementById("attendance-error");

  const deptSelect = document.getElementById("department");
  const deptEtcWrap = document.getElementById("department-etc-wrap");
  const deptEtcInput = document.getElementById("department-etc");

  if (deptSelect && deptEtcWrap && deptEtcInput) {
    deptSelect.addEventListener("change", () => {
      if (deptSelect.value === "기타") {
        deptEtcWrap.classList.remove("hidden");
      } else {
        deptEtcWrap.classList.add("hidden");
        deptEtcInput.value = "";
      }
    });
  }

  const sessionId = getQueryParam("session");
  console.log("[QRCHECK][init] sessionId from query", { sessionId });
  if (!sessionId) {
    if (infoEl) infoEl.textContent = "";
    if (errorEl) errorEl.classList.remove("hidden");
    showToast("세션 정보가 없습니다. QR을 다시 확인하세요.", "error");
    return;
  }

  const session = await fetchSession(sessionId);
  if (!session) {
    if (infoEl) infoEl.textContent = "";
    if (errorEl) errorEl.classList.remove("hidden");
    showToast("세션을 찾을 수 없습니다.", "error");
    return;
  }

  if (infoEl) {
    infoEl.textContent = `${formatDateKorean(session.date)} · ${
      session.title
    }`;
  }

  if (form) {
    form.classList.remove("hidden");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form) return;

      if (successEl) successEl.classList.add("hidden");
      if (dupEl) dupEl.classList.add("hidden");
      if (errEl) errEl.classList.add("hidden");

      const nameInput = document.getElementById("name");
      const deptInput = document.getElementById("department");
      if (!(nameInput instanceof HTMLInputElement)) return;
      if (!(deptInput instanceof HTMLSelectElement)) return;

      const rawName = nameInput.value.trim();
      const rawDept = deptInput.value;
      const etcDept =
        deptSelect && deptSelect.value === "기타" && deptEtcInput
          ? deptEtcInput.value.trim()
          : "";

      const name = rawName;

      let department = rawDept;
      if (rawDept === "기타") {
        department = etcDept || "기타";
      }

      if (!name || !department) {
        showToast("이름과 부서를 모두 입력해 주세요.", "error");
        return;
      }

      console.log("[QRCHECK][submit] payload", {
        sessionId,
        name,
        department,
      });

      const dup = await findDuplicateAttendance(sessionId, name, department);
      if (dup) {
        if (dupEl) dupEl.classList.remove("hidden");
        showToast("이미 출석이 등록된 인원입니다.", "default");
        return;
      }

      const inserted = await insertAttendance(sessionId, name, department);
      if (!inserted || inserted.ok === false) {
        if (errEl) errEl.classList.remove("hidden");
        showToast("출석 등록에 실패했습니다.", "error");
        return;
      }

      if (successEl) successEl.classList.remove("hidden");
      showToast("출석이 등록되었습니다.", "success");

      // 관리자 탭 실시간 반영용 브로드캐스트
      try {
        if ("BroadcastChannel" in window) {
          const bc = new BroadcastChannel("FIRE_QR_CHANNEL_V1");
          bc.postMessage({
            type: "DB_UPDATED",
            payload: { session_id: sessionId, attendance_id: inserted.data?.id },
          });
          bc.close();
        }
      } catch (e) {
        console.warn("[QRCHECK][broadcast] failed", e);
      }

      nameInput.value = "";
      deptInput.value = "";
      if (deptEtcInput) deptEtcInput.value = "";
      if (deptEtcWrap) deptEtcWrap.classList.add("hidden");
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initQrCheck();
});

