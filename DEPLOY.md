# GATP Slack automation - deploy notes
1. Fill slackChannelId for each client in gatp_slack_clients_v1.json (not needed while testing).
2. Vercel > Settings > Environment Variables (see ENV.example), then redeploy.
3. Invite the Slack bot to every channel it posts in (scope: chat:write).
4. Open /api/monthly-reminders?dryRun=1 to preview without sending.

## Cron plan
vercel.json runs the check every hour (needs Vercel Pro); the function decides day + time.
On the free Hobby plan: delete vercel.json and rename vercel.hobby.json to vercel.json (runs once a day ~10:00 IST).

## TEST MODE (see ENV.example)
Set TEST_SLACK_CHANNEL_ID and every message goes to that one channel, marked [TEST], HR is not pinged.
TEST_DATE / TEST_TIME pretend it is that day/time (e.g. 2026-10-05 and 10:05 = invoice day; 2026-10-15 = payment follow-up day).
Then open https://YOUR-APP.vercel.app/api/monthly-reminders in the browser to run it now (add the Bearer CRON_SECRET only if you set one).
Test runs use their own duplicate records, so they never block the real reminders.
Marking a client Paid in the tracker also posts to the test channel while test mode is on.
WHEN DONE: delete TEST_SLACK_CHANNEL_ID, TEST_DATE, TEST_TIME, TEST_PING_HR and redeploy.
