let activeFetches = new Set();

chrome.runtime.onSuspend.addListener(() => {
  for (let controller of activeFetches) {
    controller.abort();
  }
  activeFetches.clear();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "postToInstagram") {
    const { tweetId, tweetText } = message;
    console.log("Processing request for:", tweetId, tweetText);

    const controller = new AbortController();
    activeFetches.add(controller);

    fetch("http://localhost:4000/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tweetId, tweetText }),
      signal: controller.signal
    })
      .then(async (response) => {
        console.log("Response status:", response.status);
        
        // Check content type header
        const contentType = response.headers.get("content-type");
        let data;

        if (contentType && contentType.includes("application/json")) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        if (!response.ok) {
          throw new Error(
            typeof data === 'object' 
              ? data.message || `HTTP error! status: ${response.status}`
              : data || `HTTP error! status: ${response.status}`
          );
        }

        console.log("Response data:", data);
        sendResponse({ 
          success: true, 
          data,
          type: contentType?.includes("application/json") ? "json" : "text"
        });
      })
      .catch((error) => {
        console.error("Error in fetch:", error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Failed to process request',
          type: "error"
        });
      })
      .finally(() => {
        activeFetches.delete(controller);
      });

    return true;
  }
});

// Handle connection errors
chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      console.error('Connection error:', chrome.runtime.lastError);
    }
  });
});