// 监听标签页更新
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//   if (
//     changeInfo.status === "complete" &&
//     tab.url?.includes("xiaohongshu.com")
//   ) {
//     chrome.scripting.executeScript({
//       target: { tabId: tabId },
//       files: ['content.js'],
//     });
//   }
// });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadge" && sender.tab) {
    // 设置徽章文本
    chrome.action.setBadgeText({
      text: request.count.toString(),
      tabId: sender.tab.id,
    });

    // 设置徽章背景色（可选）
    chrome.action.setBadgeBackgroundColor({
      color: "#FF4444",
      tabId: sender.tab.id,
    });
  }
});
