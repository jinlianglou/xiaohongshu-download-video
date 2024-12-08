
let videoUrl = null;
let lastDetectedUrls = new Set();
let observer = null;

function findVideoInfo() {
  let videoInfos = [];

  // 方法1: 直接从页面中查找视频元素
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (video.src && video.src.startsWith('http')) {
      // 查找视频所在的容器
      const container = video.closest('[class*="note-"], [class*="feed-"], [class*="content-"]');
      
      // 查找标题和封面
      let title = '';

      if (container) {
        // 尝试从容器中获取纯文本标题
        const titleElement = container.querySelector('[class*="title"], [class*="content"]');
        // 获取纯文本内容，移除所有HTML标签
        title = titleElement?.textContent?.replace(/<[^>]*>/g, '')?.trim() || '';
      }

      // 如果没有找到标题，使用备用方案
      if (!title) {
        title = document.querySelector('meta[property="og:title"]')?.content
          || document.title.replace(/小红书/g, '').trim()
          || '小红书视频';
      }

      // 清理标题
      title = title
        .replace(/[\n\r\t]/g, ' ') // 替换换行和制表符为空格
        .replace(/\s+/g, ' ') // 多个空格替换为单个空格
        .replace(/[<>:"/\\|?*]/g, '_') // 替换文件名中的非法字符
        .trim();

      videoInfos.push({
        url: video.src,
        title: title,
        quality: video.src.includes('_hd') ? 'HD' : 'SD',
        type: 'mp4'
      });
    }
  });

  // 方法2: 从网络请求中查找视频
  const entries = performance.getEntriesByType('resource');
  entries.forEach(entry => {
    if (entry.name.includes('.mp4') && !videoInfos.some(info => info.url === entry.name)) {
      videoInfos.push({
        url: entry.name,
        title: document.title || '小红书视频',
        cover: null,
        quality: entry.name.includes('_hd') ? 'HD' : 'SD',
        type: 'mp4'
      });
    }
  });

  // 清理和格式化数据
  videoInfos = videoInfos
    // 清理数据
    .map(info => ({
      url: info.url.includes('?') ? info.url : `${info.url}?${Date.now()}`,
      title: (info.title || '小红书视频').replace(/[\n\r\t]/g, ' ').trim(),
      quality: info.quality,
      type: 'mp4'
    }))
    // 先按URL去重
    .filter((info, index, self) => 
      index === self.findIndex((t) => t.url === info.url)
    )
    // 对于相同标题只保留最后一个
    .reverse() // 先反转数组，这样filter会保留最后一个出现的项
    .filter((info, index, self) => 
      index === self.findIndex((t) => t.title === info.title)
    )
    .reverse(); // 再反转回来保持原有顺序

  console.log('找到的视频信息:', videoInfos);
  return videoInfos;
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      try {
        clearTimeout(timeout);
        func(...args);
      } catch (error) {
        console.error('执行延迟函数时出错:', error);
      }
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 检测视频并缓存结果
const detectVideos = debounce(() => {
  try {
    const videoInfos = findVideoInfo();
    const newUrls = new Set(videoInfos.map(info => info.url));
    
    // 如果视频数量发生变化，发送消息给 background.js
    chrome.runtime.sendMessage({ 
      action: 'updateBadge', 
      count: newUrls.size 
    });
    
    // 更新已检测到的URL集合
    lastDetectedUrls = newUrls;
    
    // 原有的视频信息发送
    try {
      chrome.runtime.sendMessage({ 
        action: 'videoDetected', 
        videoInfos: videoInfos 
      });
    } catch (e) {
      console.log('发送消息失败，可能是popup未打开');
    }
  } catch (error) {
    console.error('检测视频时出错:', error);
  }
}, 1000);

// 初始化MutationObserver
function initializeObserver() {
  try {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      try {
        for (const mutation of mutations) {
          if (mutation.addedNodes.length) {
            const hasNewVideo = Array.from(mutation.addedNodes).some(node => {
              return node.nodeName === 'VIDEO' || 
                     (node.querySelector && node.querySelector('video'));
            });
            if (hasNewVideo) {
              detectVideos();
              break;
            }
          }
        }
      } catch (error) {
        console.error('处理DOM变化时出错:', error);
      }
    });

    // 开始观察整个文档的变化
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  } catch (error) {
    console.error('初始化观察者时出错:', error);
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  try {
    detectVideos();
    initializeObserver();
  } catch (error) {
    console.error('初始化时出错:', error);
  }
});

// 页面URL变化时重新检测
let lastUrl = location.href;
new MutationObserver(() => {
  try {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      detectVideos();
    }
  } catch (error) {
    console.error('URL变化处理时出错:', error);
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// 监听来自popup的消息
let messageListener = (request, sender, sendResponse) => {
  try {
    if (request.action === 'getVideoUrl') {
      const videoInfos = findVideoInfo();
      sendResponse({ videoInfos: videoInfos });
    }
  } catch (error) {
    console.error('处理消息时出错:', error);
    sendResponse({ error: error.message });
  }
  return true;
};

try {
  chrome.runtime.onMessage.removeListener(messageListener);
} catch (e) {
  // 忽略移除监听器的错误
}

try {
  chrome.runtime.onMessage.addListener(messageListener);
} catch (e) {
  console.error('添加消息监听器失败:', e);
}

// 注入调试函数
try {
  window.debugFindVideo = findVideoInfo;
} catch (e) {
  console.error('注入调试函数失败:', e);
}
console.log('content.js loaded');