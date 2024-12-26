import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 4000;

let browser, page;
const INSTAGRAM_LOGIN_URL = "https://www.instagram.com/accounts/login/";
const INSTAGRAM_POST_URL = "https://www.instagram.com/create/style/";
const TWITTER_API_TOKEN = process.env.TWITTER_API_TOKEN;
const INSTAGRAM_USERNAME = process.env.INSTAGRAM_USERNAME;
const INSTAGRAM_PASSWORD = process.env.INSTAGRAM_PASSWORD;

app.use(express.json());
app.use(cors());

async function downloadVideo(tweetId, filepath) {
  const TWEET_URL = `https://api.twitter.com/2/tweets/${tweetId}?expansions=attachments.media_keys&media.fields=variants,url`;
  const response = await fetch(TWEET_URL, {
    headers: {
      Authorization: `Bearer ${TWITTER_API_TOKEN}`,
    },
  });

  console.log("response of video downloaded", response);

  if (!response.ok) {
    throw new Error(`Failed to fetch tweet: ${response.statusText}`);
  }

  const data = await response.json();
  const videoUrl = data.includes?.media?.[0]?.variants?.[0]?.url;

  if (!videoUrl) {
    throw new Error("No video found in tweet");
  }

  console.log("response of videoUrl", videoUrl);

  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.statusText}`);
  }

  console.log("response of videoResponse", videoResponse);

  const fileStream = fs.createWriteStream(filepath);
  return new Promise((resolve, reject) => {
    videoResponse.body.pipe(fileStream);
    videoResponse.body.on("error", reject);
    fileStream.on("finish", () => {
      fileStream.close();
      resolve(filepath);
    });
  });
}

async function loginToInstagram() {
  browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  });  
  page = await browser.newPage();
  page.setDefaultTimeout(80000);

  await page.goto(INSTAGRAM_LOGIN_URL);
  await page.waitForSelector("#loginForm");
  await page.type('#loginForm input[name="username"]', INSTAGRAM_USERNAME);
  await page.type('#loginForm input[name="password"]', INSTAGRAM_PASSWORD);
  await page.waitForSelector(
    '#loginForm button[type="submit"]:not([disabled])'
  );
  await page.click('#loginForm button[type="submit"]');

  await page.waitForNavigation();

  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 40000)));

  console.log("Login successful");
}

async function ensureInstagramLogin() {
  if (!page || page.isClosed()) {
    await loginToInstagram();
  } else {
    try {
      await page.goto(INSTAGRAM_LOGIN_URL);
      await page.waitForTimeout(10000);
      if (page.url() !== INSTAGRAM_POST_URL) {
        await loginToInstagram();
      }
    } catch (error) {
      await loginToInstagram();
    }
  }
}

async function uploadToInstagram(videoPath, caption) {
  await ensureInstagramLogin();

  // Navigate to Instagram create page
  await page.goto("https://www.instagram.com/");
  await page.evaluate(
    () => new Promise((resolve) => setTimeout(resolve, 20000))
  );

  await page.waitForSelector('svg[aria-label="Create"]');
  await page.click('svg[aria-label="Post"]');
  await page.evaluate(
    () => new Promise((resolve) => setTimeout(resolve, 20000))
  );

  // Handle file input for video upload
  const [fileChooser] = await Promise.all([
    page.waitForFileChooser(),
    page.click('[role="dialog"] button:has-text("Select from computer")'),
  ]);

  await fileChooser.accept([videoPath]);
  await page.evaluate(
    () => new Promise((resolve) => setTimeout(resolve, 20000))
  );

  // Wait for and click the Next button
  await page.waitForSelector('button:has-text("Next")');
  await page.click('button:has-text("Next")');
  await page.evaluate(
    () => new Promise((resolve) => setTimeout(resolve, 20000))
  );

  // Wait for and click the Next button again (skip filters)
  await page.waitForSelector('button:has-text("Next")');
  await page.click('button:has-text("Next")');
  await page.evaluate(
    () => new Promise((resolve) => setTimeout(resolve, 20000))
  );

  // Add caption if provided
  if (caption) {
    // Try multiple possible selectors for the caption field
    try {
      await page.waitForSelector(
        '[role="dialog"] textarea[aria-label="Caption"]',
        { timeout: 20000 }
      );
      await page.type(
        '[role="dialog"] textarea[aria-label="Caption"]',
        caption
      );
    } catch (error) {
      try {
        // Try alternative selector
        await page.waitForSelector('[role="dialog"] textarea', {
          timeout: 20000,
        });
        await page.type('[role="dialog"] textarea', caption);
      } catch (error) {
        console.log(
          "Could not find caption textarea, attempting to continue..."
        );
      }
    }
  }

  // Share the post
  await page.waitForSelector('button:has-text("Share")');
  await page.click('button:has-text("Share")');
  await page.evaluate(
    () => new Promise((resolve) => setTimeout(resolve, 20000))
  );
}

app.post("/upload", async (req, res) => {
  const { tweetId, tweetText } = req.body;
  const videoDir = path.join(process.cwd(), "videos");
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir);
  }

  const videoPath = path.join(videoDir, `${tweetId}.mp4`);

  try {
    // Wait for download to complete and get the filepath
    const downloadedPath = await downloadVideo(tweetId, videoPath);
    console.log(`Video downloaded successfully to: ${downloadedPath}`);

    // Proceed with Instagram upload only if download was successful
    await uploadToInstagram(downloadedPath, tweetText);
    res.status(200).send("Successfully posted to Instagram");
  } catch (error) {
    console.error("Error during process:", error);
    res.status(500).send(`Failed to process: ${error.message}`);
  } finally {
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
    // Don't close the browser immediately after each request
    // Only close if there's an error
    if ( browser) {
      await browser.close();
    }
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
