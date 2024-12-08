let currentVideoInfos = [];

async function downloadVideo(info) {
  try {
    const filename = `${info.title || 'video'}_${Date.now()}.mp4`;
    
    await chrome.downloads.download({
      url: info.url,
      filename: filename
    });
    
  } catch (error) {
    console.error('下载错误:', error);
    alert('下载失败，请重试');
  }
}

function updateVideoList(videoInfos) {
  const videoListDiv = document.getElementById('videoList');
  if (videoInfos && videoInfos.length > 0) {
    currentVideoInfos = videoInfos;
    
    videoListDiv.innerHTML = videoInfos.map((info, index) => `
      <div class="video-item">
        <div class="video-title">${info.title || '未知标题'}</div>
        <div>
          <span class="video-quality">${info.quality || 'SD'}</span>
        </div>
        <button data-index="${index}">下载视频</button>
      </div>
    `).join('');

    const buttons = videoListDiv.querySelectorAll('button');
    buttons.forEach(button => {
      button.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        downloadVideo(currentVideoInfos[index]);
      });
    });
  } else {
    videoListDiv.innerHTML = '<div class="no-video">未找到可下载的视频</div>';
  }
}

// 初始化
async function initialize() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('xiaohongshu.com')) {
      document.getElementById('videoList').innerHTML = 
        '<div class="no-video">请在小红书网站上使用此插件</div>';
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getVideoUrl' });
    if (response?.videoInfos) {
      updateVideoList(response.videoInfos);
    }
  } catch (error) {
    console.error('初始化错误:', error);
  }
}

document.addEventListener('DOMContentLoaded', initialize); 