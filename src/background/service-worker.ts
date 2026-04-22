chrome.runtime.onInstalled.addListener(() => {
  chrome.runtime.setUninstallURL("https://example.com/infocutter-template");
});

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (typeof message === "object" && message !== null) {
    return false;
  }

  return false;
});
