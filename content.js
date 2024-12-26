let isExtensionValid = true;

function addIconToTweets() {
  
  if (!isExtensionValid) return;

  const tweets = document.querySelectorAll("article");

  tweets.forEach((tweet) => {
    try {
      if (tweet.querySelector(".instagram-share-icon")) return;

      const actionButtons = tweet.querySelector('[role="group"]');
      if (!actionButtons) return;

      const instagramButton = document.createElement("div");
      instagramButton.className = "instagram-share-icon";
      instagramButton.style.display = "flex";
      instagramButton.style.alignItems = "center";
      instagramButton.style.justifyContent = "center";
      instagramButton.style.cursor = "pointer";
      instagramButton.style.padding = "8px";
      instagramButton.style.transition = "all 0.2s ease";

      const icon = document.createElement("img");
      icon.src = chrome.runtime.getURL("assets/icon.png");
      icon.style.transition = "opacity 0.2s ease";
      icon.style.width = "18px";
      icon.style.height = "18px";

      instagramButton.onmouseenter = () => {
        if (!isExtensionValid) return;
        icon.style.opacity = "0.7";
      };
      instagramButton.onmouseleave = () => {
        if (!isExtensionValid) return;
        icon.style.opacity = "1";
      };

      instagramButton.appendChild(icon);

      const buttons = actionButtons.children;
      const lastButton = buttons[buttons.length - 1];
      actionButtons.insertBefore(instagramButton, lastButton);

      instagramButton.addEventListener("click", async (e) => {
        if (!isExtensionValid) return;
        
        e.preventDefault();
        e.stopPropagation();

        const tweetText = tweet.querySelector('[data-testid="tweetText"]')?.textContent.trim() || "";
        const timeElement = tweet.querySelector('time');
        const tweetUrl = timeElement?.parentElement?.getAttribute('href');

        if (tweetUrl) {
          const tweetId = extractTweetId(tweetUrl);
          console.log("Tweet text:", tweetText, "Tweet ID:", tweetId);

          if (tweetId) {
            chrome.runtime.sendMessage(
              {
                action: "postToInstagram",
                tweetText,
                tweetId,
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error('Runtime error:', chrome.runtime.lastError);
                  return;
                }
                console.log('Response:', response);
              }
            );
          }
        }
      });
    } catch (error) {
      if (error.message.includes('Extension context invalidated')) {
        isExtensionValid = false;
        console.log('Extension needs to be reloaded');
      }
    }
  });
}

function extractTweetId(url) {
  if (!url) return null;
  const idPattern = /status\/(\d+)/;
  const match = url.match(idPattern);
  return match ? match[1] : null;
}

// Add error handling to observer
const observer = new MutationObserver((mutations) => {
  try {
    if (!isExtensionValid) {
      observer.disconnect();
      return;
    }
    addIconToTweets();
  } catch (error) {
    if (error.message.includes('Extension context invalidated')) {
      isExtensionValid = false;
      observer.disconnect();
      console.log('Extension needs to be reloaded');
    }
  }
});

try {
  observer.observe(document.body, { childList: true, subtree: true });
  addIconToTweets();
} catch (error) {
  if (error.message.includes('Extension context invalidated')) {
    isExtensionValid = false;
    console.log('Extension needs to be reloaded');
  }
}

// Add cleanup logic
chrome.runtime.onSuspend.addListener(() => {
  isExtensionValid = false;
  observer.disconnect();
});