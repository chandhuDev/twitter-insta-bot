function addIconToTweets() {
  const tweets = document.querySelectorAll("article");

  tweets.forEach((tweet) => {
    if (tweet.querySelector(".icon")) return;

    const icon = document.createElement("img");
    icon.src = "📤";
    icon.className = "icon";
    icon.style.position = "absolute";
    icon.style.top = "10px";
    icon.style.right = "10px";
    icon.style.width = "20px";
    icon.style.height = "20px";
    icon.style.cursor = "pointer";

    tweet.style.position = "relative";

    icon.addEventListener("click", async () => {
      const tweetText =
        document.getElementById("id__n4hqxpvywq")?.textContent.trim() ||
        "blah blah blah!";
      console.log("Tweet text:", tweetText);

      const shareButton = document
        .getElementById("id__fmjtptxwb68")
        ?.querySelector('button[aria-label="Share post"]');
      if (shareButton) {
        shareButton.addEventListener("click", async (event) => {
          event.stopPropagation();
          const menuDiv = document.querySelector('div[role="menu"]');
          if (menuDiv?.firstElementChild) {
            menuDiv.firstElementChild.click();
            console.log("Clicked the first child of the menu.");

            const tweetId = await getTweetLink();

            chrome.runtime.sendMessage({
              action: "postToInstagram",
              tweetText,
              tweetId,
            });
          } else {
            console.error("Menu div or its first child not found.");
          }
        });
      }
    });
    tweet.appendChild(icon);
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
