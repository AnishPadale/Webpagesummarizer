// Initialise usage counters the first time the extension is installed.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason !== "install") return;
  chrome.storage.local.set({ pageCount: 0, paidUser: false });
});
