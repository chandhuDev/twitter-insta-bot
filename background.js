chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'postToInstagram') {
      const { videosrc, text } = message;
      
      try {
          // Send the video source to the Node.js server
          const response = await fetch('http://localhost:3000/upload', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ videosrc : videosrc, text: text})
          });

          if (!response.ok) throw new Error('Failed to upload video');

          console.log('Video upload initiated');
      } catch (error) {
          console.error('Error uploading video:', error);
      }
  }
});
