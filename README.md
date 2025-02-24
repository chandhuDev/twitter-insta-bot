# Twitter to Instagram Automation Bot

This automation tool streamlines the process of cross-posting content from Twitter to Instagram. It automatically downloads tweets (including videos), posts them to your Instagram account, and manages cleanup of temporary files in the background.

## Features

- Video support
- Automatic Instagram posting
- Background file cleanup
- Logging system

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Twitter Developer Account
- Instagram Business or Creator Account
  
## Installation

1. Clone the repository:
```bash
git clone https://github.com/chandhuDev/twitter-insta-bot.git
cd twitter-insta-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
# Twitter API Credentials
TWITTER_API_TOKEN=your_twitter_api_token


# Instagram API Credentials
INSTAGRAM_USERNAME=your_instagram_username
INSTAGRAM_PASSWORD=your_instagram_password

```

## Usage

1. Start the server:
```bash
npm start
```

The bot will now:
- Download new tweets and media
- Post content to Instagram
- Automatically clean up downloaded files after successful posting

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
