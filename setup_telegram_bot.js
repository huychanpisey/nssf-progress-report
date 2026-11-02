const fs = require('fs');
const path = require('path');

// Allow token from CLI argument, or .env, or prompt
let token = process.argv[2];

if (!token) {
  // Try reading from .env
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m);
    if (match && match[1].trim()) {
      token = match[1].trim();
    }
  }
}

if (!token) {
  console.log('================================================================');
  console.log('   NSSF Telegram Bot Webhook Setup Helper');
  console.log('================================================================\n');
  console.log('Usage: node setup_telegram_bot.js <YOUR_TELEGRAM_BOT_TOKEN>');
  console.log('Example: node setup_telegram_bot.js 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ\n');
  console.log('To get a Bot Token:');
  console.log('1. Open Telegram and search for @BotFather');
  console.log('2. Send /newbot and follow instructions to name your bot');
  console.log('3. Copy the HTTP API token provided by BotFather');
  console.log('4. Run: node setup_telegram_bot.js <YOUR_TOKEN>\n');
  process.exit(1);
}

const WEBHOOK_URL = 'https://nssf-progress-report-pisey3.vercel.app/api/telegram-webhook';

async function setup() {
  console.log('================================================================');
  console.log('   Checking Telegram Bot & Setting Webhook...');
  console.log('================================================================\n');

  try {
    // 1. Check Bot Identity
    console.log('1. Testing Bot Token with Telegram API...');
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) {
      console.error('❌ Failed! Telegram returned error:', meData.description);
      process.exit(1);
    }
    const bot = meData.result;
    console.log(`✅ Connected successfully to Bot: @${bot.username} (${bot.first_name})\n`);

    // 2. Set Webhook
    console.log(`2. Setting Webhook to: ${WEBHOOK_URL}...`);
    const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(WEBHOOK_URL)}&drop_pending_updates=true`);
    const setData = await setRes.json();
    if (!setData.ok) {
      console.error('❌ Failed to set webhook:', setData.description);
      process.exit(1);
    }
    console.log(`✅ Webhook set successfully! (${setData.description})\n`);

    // 3. Verify Webhook Status
    console.log('3. Verifying Webhook Info...');
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const infoData = await infoRes.json();
    if (infoData.ok) {
      console.log('   • Webhook URL:', infoData.result.url);
      console.log('   • Pending updates:', infoData.result.pending_update_count);
      if (infoData.result.last_error_message) {
        console.warn('   ⚠️ Last error notice:', infoData.result.last_error_message);
      } else {
        console.log('   • Webhook health: 100% OK, no errors reported.');
      }
    }
    console.log('');

    // 4. Save to .env and .env.local
    console.log('4. Saving TELEGRAM_BOT_TOKEN to .env and .env.local...');
    ['.env', '.env.local'].forEach(fileName => {
      const p = path.resolve(__dirname, fileName);
      if (fs.existsSync(p)) {
        let content = fs.readFileSync(p, 'utf8');
        if (content.includes('TELEGRAM_BOT_TOKEN=')) {
          content = content.replace(/^#?\s*TELEGRAM_BOT_TOKEN=.*$/m, `TELEGRAM_BOT_TOKEN=${token}`);
        } else {
          content += `\nTELEGRAM_BOT_TOKEN=${token}\n`;
        }
        fs.writeFileSync(p, content, 'utf8');
        console.log(`   ✅ Saved to ${fileName}`);
      }
    });

    console.log('\n================================================================');
    console.log('   🎉 Telegram Bot Setup Complete!');
    console.log('================================================================');
    console.log(`Bot: @${bot.username}`);
    console.log(`Webhook: ${WEBHOOK_URL}\n`);
    console.log('👉 Next Steps for Vercel Cloud:');
    console.log('1. Go to https://vercel.com/dashboard -> select project "nssf-progress-report"');
    console.log('2. Go to Settings -> Environment Variables');
    console.log('3. Add TELEGRAM_BOT_TOKEN with your token value');
    console.log('4. Ensure "Deployment Protection" is turned OFF so Telegram can deliver files');
    console.log('5. Open Telegram, open @' + bot.username + ', and send your Word file (*.docx)!');
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

setup();
