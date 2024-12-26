chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "postToInstagram") {
    const { tweetId, tweetText } = message;
    console.log("Processing request for:", tweetId, tweetText);

    // Using fetch with proper error handling
    fetch("http://localhost:4000/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tweetId, tweetText }),
    })
      .then(async (response) => {
        console.log("Response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Response data:", data);
        sendResponse({ success: true, data });
      })
      .catch((error) => {
        console.error("Error in fetch:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Important: keeps the message channel open for async response
  }
});