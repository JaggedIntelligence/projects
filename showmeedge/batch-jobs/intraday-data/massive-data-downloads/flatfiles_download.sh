# Set up your rclone configuration
rclone config create s3massive s3 env_auth=false access_key_id=e754da0f-31d9-4e10-82c3-d76094190342 secret_access_key=lZFbR15FKx1HOiNqlVUbiagM0hPOog5K endpoint=https://files.massive.com

# List
rclone ls s3massive:flatfiles

# Copy
#rclone copy s3massive:flatfiles/us_stocks_sip/trades_v1/2025/11/2025-11-05.csv.gz .

rclone copy s3massive:flatfiles/us_stocks_sip/minute_aggs_v1/2026/07/2026-07-24.csv.gz .
