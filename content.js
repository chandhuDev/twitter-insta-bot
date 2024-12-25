function addIconToTweets() {
  const tweets = document.querySelectorAll("article");

  tweets.forEach((tweet) => {
    if (tweet.querySelector(".icon")) return;

    // Find the tweet interaction buttons group
    const actionButtons = tweet.querySelector('[role="group"]');
    if (!actionButtons) return;

    // Create the Instagram share button
    const instagramButton = document.createElement("div");
    instagramButton.className = "instagram-share-icon";
    instagramButton.style.display = "flex";
    instagramButton.style.alignItems = "center";
    instagramButton.style.justifyContent = "center";
    instagramButton.style.cursor = "pointer";
    instagramButton.style.padding = "8px";
    
    // Create and style the icon
    const icon = document.createElement("img");
    icon.src = chrome.runtime.getURL("instagram-icon.png"); // Make sure to add this icon to your extension
    icon.style.width = "18px";
    icon.style.height = "18px";
    
    instagramButton.appendChild(icon);

    // Insert the button before the last action button (usually the share button)
    const buttons = actionButtons.children;
    const lastButton = buttons[buttons.length - 1];
    actionButtons.insertBefore(instagramButton, lastButton);

    instagramButton.addEventListener("click", async () => {
      const tweetText = tweet.querySelector('[data-testid="tweetText"]')?.textContent.trim() || "";
      console.log("Tweet text:", tweetText);

      const tweetId = await getTweetLink();
      if (tweetId) {
        chrome.runtime.sendMessage({
          action: "postToInstagram",
          tweetText,
          tweetId,
        });
      }
    });
  });
}

async function extractTweetId(url) {
  const idPattern = /status\/(\d+)$/;
  const match = url.match(idPattern);
  return match ? match[1] : null;
}

async function getClipboardUrl() {
  try {
    const clipboardText = await navigator.clipboard.readText();
    const urlPattern = /https:\/\/x\.com\/\w+\/status\/\d+/;
    return urlPattern.test(clipboardText) ? clipboardText : null;
  } catch (err) {
    console.error("Failed to read from clipboard:", err);
    return null;
  }
}

async function getTweetLink() {
  const clipboardUrl = await getClipboardUrl();
  if (clipboardUrl) {
    const tweetId = await extractTweetId(clipboardUrl);
    if (tweetId) {
      return tweetId;
    }
  }
}

const observer = new MutationObserver(addIconToTweets);
observer.observe(document.body, { childList: true, subtree: true });

addIconToTweets();
