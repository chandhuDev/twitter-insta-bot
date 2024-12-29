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

let browser, page, videoPath;
const INSTAGRAM_LOGIN_URL = "https://www.instagram.com/accounts/login/";
const TWITTER_API_TOKEN = process.env.TWITTER_API_TOKEN;
const INSTAGRAM_USERNAME = process.env.INSTAGRAM_USERNAME;
const INSTAGRAM_PASSWORD = process.env.INSTAGRAM_PASSWORD;

app.use(express.json());
app.use(cors());

process.on("uncaughtException", handleProcessError);
process.on("unhandledRejection", handleProcessError);

function getTempDirectory() {
  if (process.platform === "win32") {
    // On Windows, use a directory in the current project
    return path.join(process.cwd(), "temp");
  }
  // On Linux/Mac use /tmp
  return "/tmp";
}

async function handleProcessError(error) {
  console.error("Process error:", error);
  try {
    // Cleanup browser
    if (browser) {
      await browser.close();
    }

    // Cleanup temp directory
    const tempDir = path.join(getTempDirectory(), "videos");
    await cleanupDirectory(tempDir);
  } catch (cleanupError) {
    console.error("Error during emergency cleanup:", cleanupError);
  } finally {
    process.exit(1);
  }
}

async function cleanupDirectory(directory) {
  try {
    if (fs.existsSync(directory)) {
      const files = await fs.promises.readdir(directory);
      for (const file of files) {
        const filePath = path.join(directory, file);
        await fs.promises.unlink(filePath);
      }
      await fs.promises.rmdir(directory);
    }
  } catch (error) {
    console.error(`Failed to cleanup directory ${directory}:`, error);
    throw error;
  }
}

async function downloadVideo(tweetId, filepath) {
  try {
    const videoDir = path.join(getTempDirectory(), 'videos');
    await fs.promises.mkdir(videoDir, { recursive: true });

    const TWEET_URL = `https://api.twitter.com/2/tweets/${tweetId}?expansions=attachments.media_keys&media.fields=variants,url`;
    
    const response = await fetch(TWEET_URL, {
      headers: {
        Authorization: `Bearer ${TWITTER_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tweet: ${response.statusText}`);
    }

    const data = await response.json();
    const variants = data.includes?.media?.[0]?.variants || [];
    // Get only MP4 videos and sort by bitrate to get highest quality
    const videoVariants = variants
      .filter(v => v.content_type === 'video/mp4')
      .sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0));

    if (videoVariants.length === 0) {
      throw new Error("No video found in tweet");
    }

    const videoUrl = videoVariants[0]?.url;
    const videoResponse = await fetch(videoUrl);
    const expectedSize = parseInt(videoResponse.headers.get('content-length') || '0');

    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }

    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(filepath);
      let fileSize = 0;

      videoResponse.body.on('data', (chunk) => {
        fileSize += chunk.length;
      });

      videoResponse.body.pipe(fileStream);

      videoResponse.body.on("error", (error) => {
        fileStream.close();
        fs.unlink(filepath, () => {
          reject(new Error(`Failed to download video: ${error.message}`));
        });
      });

      fileStream.on("finish", async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));

        fileStream.close();
        // Verify file size after download
        const stats = await fs.promises.stat(filepath);
        if (stats.size < 1024) { // 1KB minimum
          fs.unlink(filepath, () => {
            reject(new Error('Downloaded file is too small (less than 1KB)'));
          });
          return;
        }
        if (expectedSize && stats.size < expectedSize) {
          fs.unlink(filepath, () => {
            reject(new Error('File download incomplete'));
          });
          return;
        }

        console.log("Video download completed successfully");
        resolve(filepath);
      });

      fileStream.on("error", (error) => {
        fileStream.close();
        fs.unlink(filepath, () => {
          reject(new Error(`Failed to save video: ${error.message}`));
        });
      });
    });

  } catch (error) {
    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath).catch(() => {});
    }
    throw error;
  }
}

async function loginToInstagram() {
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--start-maximized",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        `--js-flags=--max-old-space-size=8192`,
      ],
      defaultViewport: null,
      devtools: false,
    });

    const context = browser.defaultBrowserContext();
    await context.overridePermissions("https://www.instagram.com", [
      "notifications",
    ]);
    page = await browser.newPage();
    page.setDefaultTimeout(50000);

    // Login process remains the same...
    await page.goto(INSTAGRAM_LOGIN_URL);
    await page.waitForSelector("#loginForm");
    await page.type('#loginForm input[name="username"]', INSTAGRAM_USERNAME);
    await page.type('#loginForm input[name="password"]', INSTAGRAM_PASSWORD);
    await page.click('#loginForm button[type="submit"]');
    await page.waitForNavigation({ timeout: 60000 });

    const isSecurityCodePage = await page.evaluate(() => {
      return (
        window.location.href.includes("challenge") ||
        window.location.href.includes("login")
      );
    });

    if (isSecurityCodePage) {
      console.log("Waiting for security code entry...");
      await page.waitForNavigation({
        timeout: 300000,
        waitUntil: "networkidle0",
      });
    }

    const currentUrl = await page.url();
    if (currentUrl.includes(INSTAGRAM_LOGIN_URL)) {
      throw new Error("Still on login page after verification");
    }

    console.log("Login successful!");
    return page;
  } catch (error) {
    console.error("Login process error:", error);
    throw error;
  }
}

async function ensureInstagramLogin() {
  try {
    if (!page || page.isClosed()) {
      page = await loginToInstagram();
    } else {
      const currentUrl = await page.url();
      if (currentUrl.includes("instagram.com/accounts/login")) {
        page = await loginToInstagram();
      }
    }
  } catch (error) {
    console.error("Login check error:", error);
    page = await loginToInstagram();
  }
  return page;
}

async function uploadToInstagram(videoPath, caption) {
  try {
    page = await ensureInstagramLogin();
    // Navigate to Instagram home and wait longer
    await page.goto("https://www.instagram.com/");
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    );

    await page.screenshot({
      path: path.join(getTempDirectory(), "videos", "debug.png"),
      fullPage: true,
    });

    const elements = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("span")).map((span) => ({
        text: span.textContent,
        hasParentLink: !!span.closest("a"),
        classes: span.className,
      }));
    });
    // console.log("Available elements:", elements);

    // Click Create with improved detection
    const createClicked = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const createSpan = spans.find(
        (span) => span.textContent.includes("Create") && span.closest("a")
      );
      if (createSpan) {
        createSpan.closest("a").click();
        return true;
      }
      return false;
    });
    if (!createClicked) {
      throw new Error("Could not find Create button");
    }

    console.log("Create button clicked");
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 3000))
    );

    // Improved Post button detection
    const postClicked = await page.evaluate(() => {
      // Try multiple ways to find the Post button
      const spans = Array.from(document.querySelectorAll("span"));
      const postSpan = spans.find((span) => {
        const text = span.textContent.trim();
        return (
          text === "Post" &&
          (span.closest('[role="menuitem"]') ||
            span.closest('[role="button"]') ||
            span.closest("a"))
        );
      });

      if (postSpan) {
        const clickableElement =
          postSpan.closest('[role="menuitem"]') ||
          postSpan.closest('[role="button"]') ||
          postSpan.closest("a");
        clickableElement.click();
        return true;
      }
      return false;
    });

    if (!postClicked) {
      throw new Error("Could not find Post button");
    }
    console.log("Successfully clicked Create and Post!");

    // In uploadToInstagram function, replace the file upload part with:
    let uploadAttempts = 0;
    const maxAttempts = 3;

    while (uploadAttempts < maxAttempts) {
      try {
        await page.waitForSelector('input._ac69[type="file"]');
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser(),
          page.evaluate(() => {
            const fileInput = document.querySelector(
              'input._ac69[type="file"]'
            );
            if (fileInput) {
              fileInput.click();
            } else {
              throw new Error("File input not found");
            }
          }),
        ]);

        await fileChooser.accept([videoPath]);
        await page.evaluate(
          () => new Promise((resolve) => setTimeout(resolve, 5000))
        );

        // Check if upload was successful
        const uploadError = await page.evaluate(() => {
          const errorElement = document.querySelector('[role="alert"]');
          return errorElement ? errorElement.textContent : null;
        });

        if (!uploadError) {
          console.log("File uploaded successfully");
          break;
        }

        uploadAttempts++;
        if (uploadAttempts === maxAttempts) {
          throw new Error(
            `Upload failed after ${maxAttempts} attempts: ${uploadError}`
          );
        }

        console.log(`Upload attempt ${uploadAttempts} failed, retrying...`);
        await page.evaluate(
          () => new Promise((resolve) => setTimeout(resolve, 5000))
        );
      } catch (error) {
        uploadAttempts++;
        if (uploadAttempts === maxAttempts) {
          throw error;
        }
        console.log(
          `Upload attempt ${uploadAttempts} failed with error: ${error.message}`
        );
        await page.evaluate(
          () => new Promise((resolve) => setTimeout(resolve, 5000))
        );
      }
    }

    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll('div[role="button"]')
        );
        const nextButton = buttons.find((button) =>
          button.textContent.includes("Next")
        );
        if (nextButton) nextButton.click();
      });
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 3000))
      );
      console.log(`Clicked Next button ${i + 1}`);
    }

    if (caption) {
      try {
        await page.waitForSelector('div[aria-label="Write a caption..."]', {
          timeout: 5000,
        });
        await page.type('div[aria-label="Write a caption..."]', caption);
      } catch (error) {
        console.error("Error during caption/share:", error);
        await page.screenshot({ 
          path: path.join(getTempDirectory(), "videos", "caption-error.png")
        });
      }
    }
    console.log("caption provided successfully");
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    );

    await page.waitForSelector(
      'div[role="dialog"] div[role="button"][tabindex="0"]',
      { timeout: 10000 }
    );

    await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll(
          'div[role="dialog"] div[role="button"][tabindex="0"]'
        )
      );
      const shareButton = buttons.find(
        (button) =>
          button.textContent.trim() === "Share" &&
          !button.hasAttribute("aria-label")
      );

      if (shareButton) {
        shareButton.click();
      } else {
        throw new Error("Share button not found");
      }
    });
   
    try {
      await page.waitForSelector('img[alt="Animated checkmark"]', { timeout: 60000 });
      await page.waitForFunction(
        () => {
          const elements = document.querySelectorAll('span.x1lliihq');
          return Array.from(elements).some(el => 
            el.textContent.includes('Your reel has been shared.')
          );
        },
        { timeout: 60000 }
      );
    
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 5000))
      ); 
      console.log("Post shared and confirmed successfully");
    
    } catch (error) {
      console.error("Error waiting for share confirmation:", error);
      await page.screenshot({ 
        path: path.join(getTempDirectory(), "videos", "share-error.png")
      });
      throw new Error("Failed to confirm post share completion");
    }


  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}

async function cleanupTempFiles(filepath) {
  try {
    // Remove the specific file
    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
      console.log(`Removed temp file: ${filepath}`);
    }

    // Cleanup parent directory if empty
    const dir = path.dirname(filepath);
    const files = await fs.promises.readdir(dir);

    if (files.length === 0) {
      await fs.promises.rmdir(dir);
      console.log(`Removed empty directory: ${dir}`);
    }
  } catch (error) {
    console.error("Cleanup error:", error);
    // Don't throw the error as cleanup shouldn't break the main flow
  } finally {
    // Additional cleanup checks
    try {
      // Remove any files older than 1 hour
      const tempDir = path.join(getTempDirectory(), "videos");
      if (fs.existsSync(tempDir)) {
        const files = await fs.promises.readdir(tempDir);
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        for (const file of files) {
          const filePath = path.join(tempDir, file);
          const stats = await fs.promises.stat(filePath);

          if (stats.mtimeMs < oneHourAgo) {
            await fs.promises.unlink(filePath);
            console.log(`Removed old temp file: ${filePath}`);
          }
        }
      }
    } catch (finalCleanupError) {
      console.error("Error during final cleanup:", finalCleanupError);
    }
  }
}

app.post("/upload", async (req, res) => {
  const { tweetId, tweetText } = req.body;
  const videoDir = path.join(getTempDirectory(), "videos");
  try {
    await fs.promises.mkdir(videoDir, { recursive: true });
  

     videoPath = path.join(videoDir, `${tweetId}.mp4`);

  
    const downloadedPath = await downloadVideo(tweetId, videoPath);
    const stats = await fs.promises.stat(downloadedPath);
    console.log(`Verifying downloaded file: ${stats.size} bytes`);
    if (stats.size < 1024) {
      throw new Error("File too small for upload");
    }
    console.log(`Video downloaded successfully to: ${downloadedPath}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("Starting Instagram upload...");

    await uploadToInstagram(downloadedPath, tweetText);
    res.status(200).send("Successfully posted to Instagram");
  }
  catch (error) {
    console.error("Error during process:", error);
    res.status(500).send(`Failed to process: ${error.message}`);
  } finally {
    await cleanupTempFiles(videoPath);
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
