// Popup logic: read the active tab, send its text to the backend for an AI
// summary, and track usage against the free / paid page limits.

// The backend holds the OpenAI key. The extension never sees it.
const API_BASE = "https://YOUR-BACKEND.onrender.com";
const PAYMENT_LINK = "https://rzp.io/rzp/YOUR-LINK";

const FREE_LIMIT = 3;
const PAID_LIMIT = 400;
const MAX_CHARS = 10000;

const $ = (id) => document.getElementById(id);

const ui = {
  summarize: $("summarize"),
  summary: $("summary"),
  pageCount: $("page-count"),
  copyBtn: $("copyBtn"),
  copied: $("copiedNotice"),
  emailSection: $("emailSection"),
  email: $("userEmail"),
  emailError: $("emailError"),
  payBtn: $("submitEmailBtn"),
};

const storage = {
  get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
  set: (values) => new Promise((resolve) => chrome.storage.local.set(values, resolve)),
};

let state = { pageCount: 0, paidUser: false };

const limit = () => (state.paidUser ? PAID_LIMIT : FREE_LIMIT);

function render() {
  ui.pageCount.textContent = `Pages summarized: ${state.pageCount} / ${limit()}`;
  const reached = state.pageCount >= limit();
  ui.summarize.disabled = reached;
  ui.summarize.textContent = reached ? "Limit reached" : "Summarize";
  ui.emailSection.hidden = !reached;
  if (reached && !ui.summary.textContent) {
    ui.summary.textContent = "You've used your free pages. Enter your email to upgrade.";
  }
}

// If the user has paid, the backend's webhook will have recorded their email.
async function checkPaymentStatus() {
  const { userEmail } = await storage.get("userEmail");
  if (!userEmail || state.paidUser) return;
  try {
    const res = await fetch(`${API_BASE}/check-paid?email=${encodeURIComponent(userEmail)}`);
    const { paid } = await res.json();
    if (paid) {
      state = { paidUser: true, pageCount: 0 };
      await storage.set(state);
      ui.summary.textContent = "Payment verified. Your extra pages are unlocked.";
      render();
    }
  } catch (err) {
    console.error("Payment check failed:", err);
  }
}

async function getActiveTabText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body?.innerText || "",
  });
  return result.trim().slice(0, MAX_CHARS);
}

async function requestSummary(text) {
  const res = await fetch(`${API_BASE}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  return data.summary;
}

async function onSummarize() {
  if (state.pageCount >= limit()) return render();

  ui.summarize.disabled = true;
  ui.summarize.textContent = "Summarizing...";
  ui.copyBtn.hidden = true;
  ui.summary.textContent = "";

  try {
    const text = await getActiveTabText();
    if (!text) throw new Error("No readable text found on this page.");

    ui.summary.textContent = await requestSummary(text);
    ui.copyBtn.hidden = false;

    // Only count a page once it has actually been summarized.
    state.pageCount += 1;
    await storage.set({ pageCount: state.pageCount });
  } catch (err) {
    ui.summary.textContent = `Couldn't summarize this page: ${err.message}`;
  } finally {
    render();
  }
}

async function onUpgrade() {
  const email = ui.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    ui.emailError.hidden = false;
    return;
  }
  ui.emailError.hidden = true;
  await storage.set({ userEmail: email });
  chrome.tabs.create({ url: PAYMENT_LINK });
}

async function onCopy() {
  await navigator.clipboard.writeText(ui.summary.textContent);
  ui.copied.hidden = false;
  setTimeout(() => (ui.copied.hidden = true), 2000);
}

document.addEventListener("DOMContentLoaded", async () => {
  state = { ...state, ...(await storage.get(["pageCount", "paidUser"])) };
  render();
  checkPaymentStatus();

  ui.summarize.addEventListener("click", onSummarize);
  ui.payBtn.addEventListener("click", onUpgrade);
  ui.copyBtn.addEventListener("click", onCopy);
});
