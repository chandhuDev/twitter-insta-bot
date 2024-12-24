chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "postToInstagram") {
    const { tweetId, tweetText } = message;

    try {
      const response = await fetch("http://localhost:4000/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tweetId, tweetText }), // Ensure keys match server expectations
      });

      if (!response.ok) throw new Error("Failed to upload video");

      console.log("Video upload initiated");
      sendResponse({ status: "success" });
    } catch (error) {
      console.error("Error uploading video:", error);
      sendResponse({ status: "error", message: error.message });
    }
  }
  return true; // Keep the message channel open for sendResponse
});
