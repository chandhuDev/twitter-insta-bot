// const express = require("express");
// const puppeteer = require("puppeteer");
// const bodyParser = require("body-parser");
// const cors = require("cors");

// const app = express();
// app.use(bodyParser.json());
// app.use(cors());

// app.get("/loginInsta", async (req, res) => {
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();

//   try {
//     await page.goto("https://www.instagram.com/accounts/login/");
//     await page.waitForSelector("#loginForm");
//     await page.type(
//       '#loginForm input[name="username"]',
//       "chandhu.mpc19@gmail.com"
//     );

//     // Select the password input field within the form and type into it
//     await page.type('#loginForm input[name="password"]', "Ch@ndhu123");

//     await page.waitForSelector(
//       '#loginForm button[type="submit"]:not([disabled])'
//     );

//     await page.click('#loginForm button[type="submit"]');
//     console.log("Login successful");

//     await page.waitForNavigation();

//     await page.goto("https://www.instagram.com/create/style/");
//     await page.waitForSelector('input[type="file"]');
//     const fileInput = await page.$('input[type="file"]');
//     await fileInput.uploadFile("/path/to/video/file"); // You need the local file path of the video

//     // Add text to the post
//     await page.waitForSelector("textarea");
//     await page.type("textarea", "Your custom text for the post");

//     // Submit the post
//     await page.click('button[type="submit"]');
//     await page.waitForNavigation();

//     console.log("Post successful");

//     res.json({ success: true });
//   } catch (error) {
//     console.error("Failed to login to Twitter:", error);
//     res.json({ success: false, error: error.message });
//   } finally {
//     await browser.close();
//   }
// });

// app.get("/test", async (req, res) => {
//   res.json({ msg: "how are you?" });
// });

// app.listen(3000, () => {
//   console.log("Server is running on http://localhost:3000");
// });

const express = require("express");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const port = 3000;

let browser, page;
const INSTAGRAM_LOGIN_URL = "https://www.instagram.com/accounts/login/";
const INSTAGRAM_POST_URL = "https://www.instagram.com/create/style/";
const INSTAGRAM_USERNAME = "";
const INSTAGRAM_PASSWORD = "";

app.use(express.json());
app.use(cors());

// Helper function to download video
async function downloadVideo(url, filepath) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to download video: ${response.statusText}`);
  const fileStream = fs.createWriteStream(filepath);
  return new Promise((resolve, reject) => {
    response.body.pipe(fileStream);
    response.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
}

async function loginToInstagram() {
  browser = await puppeteer.launch({ headless: false });
  page = await browser.newPage();
  await page.goto(INSTAGRAM_LOGIN_URL);
  await page.waitForSelector("#loginForm");
  await page.type('#loginForm input[name="username"]', INSTAGRAM_USERNAME);
  await page.type('#loginForm input[name="password"]', INSTAGRAM_PASSWORD);
  await page.waitForSelector(
    '#loginForm button[type="submit"]:not([disabled])'
  );
  await page.click('#loginForm button[type="submit"]');
  await page.waitForNavigation();
  console.log("Login successful");
}

async function ensureInstagramLogin() {
  if (!page || page.isClosed()) {
    await loginToInstagram();
  } else {
    try {
      await page.goto(INSTAGRAM_LOGIN_URL);
      await page.waitForTimeout(7000);
      if (page.url() !== INSTAGRAM_POST_URL) {
        await loginToInstagram();
      }
    } catch (error) {
      await loginToInstagram();
    }
  }
}

app.post("/upload", async (req, res) => {
  const { videosrc, text } = req.body;
  const videoPath = path.join(__dirname, "video.mp4");

  try {
    // Download video
    await downloadVideo(videosrc, videoPath);

    // Ensure logged in to Instagram
    await ensureInstagramLogin();

    // Navigate to the new post page
    await page.goto(INSTAGRAM_POST_URL);
    await page.waitForSelector('input[type="file"]');

    // Handle the video upload
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(videoPath);

    // Add text to the post
    await page.waitForSelector("textarea");
    await page.type("textarea", text);

    // Submit the post
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    console.log("Post successful");
    res.status(200).send("Post successful");
  } catch (error) {
    console.error("Failed to post to Instagram:", error);
    res.status(500).send("Failed to post to Instagram");
  } finally {
    // Clean up the downloaded video
    fs.unlinkSync(videoPath);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
