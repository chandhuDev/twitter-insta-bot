// Add an icon to each tweet in the feed
function addIconToTweets() {
  const tweets = document.querySelectorAll("article");
  tweets.forEach((tweet) => {
    // Check if the icon is already added
    if (tweet.querySelector(".custom-icon")) return;

    const icon = document.createElement("div");
    icon.className = "custom-icon";
    icon.textContent = "📤"; // Example icon, can be replaced with any icon
    icon.style.cursor = "pointer";
    icon.style.position = "absolute";
    icon.style.top = "10px";
    icon.style.right = "10px";
    tweet.style.position = "relative";

    icon.addEventListener("click", async (event) => {
      event.stopPropagation();

      const video = tweet.querySelector("video");
      if (video) {
        chrome.runtime.sendMessage({
          action: "postToInstagram",
          videosrc: video.src,
        });
      } else {
        console.log("No video found in the tweet");
      }
    });

    tweet.appendChild(icon);
  });
}

// Add icons initially and whenever new tweets are loaded
addIconToTweets();
window.addEventListener("scroll", addIconToTweets);
